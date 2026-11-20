"""Shared for the valley composition scripts: the river's new course, in the valley's own metres (x, z with -z ahead), smoothed and sampled
every 2 m. It comes down the right-hand valley past the hamlet terrace (to its right), swings across the meadow in front of the
viewer and enters the lake from the east, so the whole lower reach is in view."""
import numpy as np
CONTROL = [(98, -880), (80, -720), (66, -560), (61, -430), (62, -340), (58, -270), (54, -205), (50, -160), (46, -128), (36, -110), (14, -112), (-2, -124)]  # traced from the user's line on the hero frame
def route(step=2.0):
    P = np.array(CONTROL, float); P = np.vstack([P[0] * 2 - P[1], P, P[-1] * 2 - P[-2]]); out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]; n = max(2, int(np.linalg.norm(p2 - p1) / step))
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t; out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2]); out = np.array(out)
    # a stream never runs straight: small meanders on top of the course, two wavelengths, gentlest where it meets the lake
    seg = np.diff(out, axis=0); s = np.concatenate([[0], np.cumsum(np.linalg.norm(seg, axis=1))]); tang = np.gradient(out, axis=0); tang /= np.maximum(np.linalg.norm(tang, axis=1, keepdims=True), 1e-9)
    nrm = np.stack([-tang[:, 1], tang[:, 0]], 1); fade = np.clip((s[-1] - s) / 40.0, 0, 1)
    amp = (3.2 * np.sin(s / 58.0 * 6.2832 + 0.7) + 1.4 * np.sin(s / 23.0 * 6.2832 + 2.1)) * fade
    return out + nrm * amp[:, None]
def polyline_distance(px, py, Q):
    """distance from points (px, py) to the polyline Q (n x 2), and the index of the nearest segment"""
    n = len(px); best = np.full(n, 1e9); seg = np.zeros(n, int); P = np.stack([px, py], 1)
    for k in range(0, len(Q) - 1, 30):
        A = Q[k:k + 30]; B = Q[k + 1:k + 31]; m = min(len(A), len(B)); A, B = A[:m][None], B[:m][None]; AB = B - A
        t = np.clip(((P[:, None] - A) * AB).sum(-1) / np.maximum((AB * AB).sum(-1), 1e-9), 0, 1); dd = np.sqrt(((P[:, None] - (A + AB * t[..., None])) ** 2).sum(-1)); j = dd.argmin(1); dj = dd[np.arange(n), j]
        u = dj < best; best[u] = dj[u]; seg[u] = k + j[u]
    return best, seg

# The hero camera: standing low in the meadow on the river's east bank, turned a little right so the hamlet sits at the right third and the
# river leads away up the valley on the left (target 01: composition first). Valley metres, Blender axes (x right, y ahead).
CAM = (100.0, 160.0); CAM_EYE = 2.4; CAM_YAW = 10.0  # eye on a gentle rise: from 1.7 m the foreground flowers hid the pond  # degrees to the right of straight up the valley
def cam_rel(x, y):
    """distance from the camera, absolute angle off the view axis (degrees), and distance ahead along the view axis"""
    dx, dy = x - CAM[0], y - CAM[1]; yaw = np.radians(CAM_YAW)
    return np.hypot(dx, dy), np.abs(np.degrees(np.arctan2(dx, dy)) - CAM_YAW), dy * np.cos(yaw) + dx * np.sin(yaw)
