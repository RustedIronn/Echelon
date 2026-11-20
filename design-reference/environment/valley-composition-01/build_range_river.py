"""Valley composition 01, step 5: the approved range closes the valley (the valley's own single massif is lowered away behind it), and the
river is opened up - a wider channel cut into the floor, the lake's water in it, the grass kept back from its banks."""
import bpy, json, math, numpy as np
from pathlib import Path
HERE = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'valley_composition_01.blend')); scene = bpy.context.scene
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
# 1. the range
for o in [o for o in scene.objects if o.name.startswith('RANGE')]: bpy.data.objects.remove(o)
with bpy.data.libraries.load(str(HERE / 'valley-range.blend'), link=False) as (s, d): d.objects = ['RANGE approved']
rng = d.objects[0]; scene.collection.objects.link(rng)
for p in rng.data.polygons: p.use_smooth = True
# two mountains, not a row of spikes (target 01): the tallest, pointed peak and the broadest other mass stay; the rest sink to low ridges
# between them; the whole range set further back and lower, so it supports the mood instead of overpowering it
_rm2 = rng.data; _n2 = len(_rm2.vertices); _c2 = np.empty(_n2 * 3, np.float32); _rm2.vertices.foreach_get('co', _c2); _c2 = _c2.reshape(-1, 3)
_p1 = _c2[int(np.argmax(_c2[:, 2])), :2]; _far = np.hypot(_c2[:, 0] - _p1[0], _c2[:, 1] - _p1[1]) > 2600; _p2 = _c2[int(np.argmax(np.where(_far, _c2[:, 2], -1))), :2]
_keep = np.maximum(np.exp(-(np.hypot(_c2[:, 0] - _p1[0], _c2[:, 1] - _p1[1]) / 1500) ** 2), np.exp(-(np.hypot(_c2[:, 0] - _p2[0], _c2[:, 1] - _p2[1]) / 2100) ** 2))
_c2[:, 2] = _c2[:, 2] * (0.28 + 0.72 * _keep) * 0.95; _rm2.vertices.foreach_set('co', _c2.ravel()); _rm2.update(); rng.location = (0, 1700, 0)  # majestic: they rise well above the hills, still far and soft
print('RR peaks', _p1.round(0), _p2.round(0))
# the range's foot (its flat lowland, 4.5 to 6 km out) carries forest like a real valley floor under the peaks; bare, it read as a pale band in the haze
_rm = rng.data; _rn = len(_rm.vertices); _rc = np.empty(_rn * 3, np.float32); _rm.vertices.foreach_get('co', _rc); _rc = _rc.reshape(-1, 3)
_patch = 0.5 + 0.3 * np.sin(_rc[:, 0] / 310.0 + 1.1) * np.sin(_rc[:, 1] / 270.0) + 0.2 * np.sin(_rc[:, 0] / 97.0 + _rc[:, 1] / 131.0)
_rf = (1 - sm(330, 620, _rc[:, 2])) * sm(0.35, 0.55, _patch)
if 'forest' in _rm.attributes: _rm.attributes.remove(_rm.attributes['forest'])
_rm.attributes.new('forest', 'FLOAT', 'POINT').data.foreach_set('value', _rf.astype(np.float32))
# (trees on the range were tried and removed: at this distance they scattered over its lower slopes as grey speckle; the far mountain line behind closes the gap instead)
# 2. the far land gives way to it beyond about 4 km (it stays as the valley's sides nearer in)
far = scene.objects['Valley far land (polar)']; me = far.data; n = len(me.vertices)
co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3); r = np.hypot(co[:, 0], co[:, 1])
if 'orig_z' not in me.attributes: me.attributes.new('orig_z', 'FLOAT', 'POINT').data.foreach_set('value', co[:, 2].copy())
oz = np.empty(n, np.float32); me.attributes['orig_z'].data.foreach_get('value', oz)
k = sm(3600, 4500, r); k2 = sm(6800, 8200, r); co[:, 2] = (oz * (1 - k) + np.minimum(oz, 60.0) * k) * (1 - k2) + (lambda am: 700 * np.tanh(np.maximum(oz, 0) / 700) * (1 - am) + (140 + 70 * np.sin(np.arctan2(co[:, 0], co[:, 1]) * 9.0 + 0.6) + 50 * np.sin(np.arctan2(co[:, 0], co[:, 1]) * 23.0 + 2.2)) * am)(1 - sm(20, 27, np.degrees(np.abs(np.arctan2(co[:, 0], co[:, 1]))))) * k2  # behind the range a far mountain line (blue in the haze), so the gap at the range's foot reads as distant hills, not a pale flat band, so the eye never runs past the range's back edge into the sky; kept as a low floor under the range: dropped further, it left a hole below the range's front edge (sky seen through the ground)
me.vertices.foreach_set('co', co.ravel()); me.update()
for key in ('streambed', 'damp_soil'):  # it was flagged as lake bed before it was lowered: the pale gravel showed through the haze as a white band
    a = np.empty(n, np.float32); me.attributes[key].data.foreach_get('value', a); me.attributes[key].data.foreach_set('value', (a * (1 - sm(1200, 1800, r))).astype(np.float32))
# 3. the river: a channel cut into the near ground, wider toward the lake, and the water ribbon in it
import sys; sys.path.insert(0, str(HERE)); from common import route
riv = route(); rv = np.stack([riv[:, 0], -riv[:, 1]], 1); N = len(rv)
_vn = lambda t: 0.5 + 0.3 * np.sin(t * 0.11 + 1.3) + 0.2 * np.sin(t * 0.37 + 0.4)
wid = lambda i: ((1.2 + 2.8 * min(1.0, i / (0.12 * N))) + 4.0 * i / N) * (0.8 + 0.4 * _vn(i))  # a glacial river (ref: the Lonza): 8 to 16 m wide through the meadow, narrowing far up the valley  # half-width: a thread far up the valley, 1.5 to 3.5 m through the meadow, pools and narrows
near = scene.objects['Valley ground (near, 2 m)']; me = near.data; n = len(me.vertices)
co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3).astype(float)
if 'orig_z' not in me.attributes: me.attributes.new('orig_z', 'FLOAT', 'POINT').data.foreach_set('value', co[:, 2].astype(np.float32))
oz = np.empty(n, np.float32); me.attributes['orig_z'].data.foreach_get('value', oz); co[:, 2] = oz
P = co[:, :2]; best = np.full(n, 1e9); seg = np.zeros(n, int)
for kk in range(0, N - 1, 30):
    A = rv[kk:kk + 30][None]; B = rv[kk + 1:kk + 31][None]; m = min(A.shape[1], B.shape[1]); A, B = A[:, :m], B[:, :m]; AB = B - A
    t = np.clip(((P[:, None] - A) * AB).sum(-1) / np.maximum((AB * AB).sum(-1), 1e-9), 0, 1); dd = np.sqrt(((P[:, None] - (A + AB * t[..., None])) ** 2).sum(-1)); j = dd.argmin(1); dj = dd[np.arange(n), j]
    upd = dj < best; best[upd] = dj[upd]; seg[upd] = kk + j[upd]
w = np.array([wid(i) for i in range(N)])[seg]
# water level along the course: the ground under it (the low point nearby), smoothed, only ever running downhill, a little below the banks
_m = near.data; _c = co; _oz = oz
_x0, _y0 = _c[:, 0].min(), _c[:, 1].min(); _grid = np.full((480, 500), np.nan); _grid[np.round((_c[:, 1] - _y0) / 2).astype(int), np.round((_c[:, 0] - _x0) / 2).astype(int)] = _oz
def _low(x, y):
    i = int(round((x - _x0) / 2)); j = int(round((y - _y0) / 2)); win = _grid[max(j - 2, 0):j + 3, max(i - 2, 0):i + 3]; return np.nanmin(win) if win.size and not np.all(np.isnan(win)) else 0.0
ry = np.array([_low(p[0], p[1]) for p in rv]); ry = np.convolve(np.pad(ry, 7, mode='edge'), np.ones(15) / 15, mode='valid')
lvl = np.maximum(np.minimum.accumulate(ry) - 0.18, 0.0)
L_ = lvl[seg]; rnd = (np.sin(co[:, 0] * 0.9) * np.sin(co[:, 1] * 1.3)) * 0.12  # uneven banks: the water's edge wanders
dry = oz > 0.15  # the banks are raised only on dry ground, never inside the lake (that left a ledge ring in it)
inner = best < w; band = (best >= w) & (best < w * 1.5 + 1.0) & dry; out_ = (best >= w * 1.5 + 1.0) & (best < w * 1.5 + 5.0) & dry
bedz = L_ - 0.45 * (1 - (best / np.maximum(w, 1e-3)) ** 2) - 0.06
bankz = np.maximum(co[:, 2], L_ + 0.03 + 0.12 * sm(w, w * 1.5 + 1.0, best) + rnd * 0.35)  # low banks: from this eye height tall ones hid the water
co[:, 2] = np.where(inner, np.minimum(co[:, 2], bedz), co[:, 2])
co[:, 2] = np.where(band, bankz, co[:, 2])
blend = sm(w * 1.5 + 1.0, w * 1.5 + 5.0, best); co[:, 2] = np.where(out_, co[:, 2] * blend + np.maximum(co[:, 2], L_ + 0.35) * (1 - blend), co[:, 2])
for _k, _v in (('river_d', best), ('river_w', w)):  # kept for the bank dressing (build_river_dress.py)
    if _k in me.attributes: me.attributes.remove(me.attributes[_k])
    me.attributes.new(_k, 'FLOAT', 'POINT').data.foreach_set('value', _v.astype(np.float32))
me.vertices.foreach_set('co', co.astype(np.float32).ravel()); me.update()
bed = np.maximum(1 - sm(w * 0.7, w * 1.0, best), (co[:, 2] < 0.02).astype(float)); me.attributes['streambed'].data.foreach_set('value', bed.astype(np.float32))
damp = np.maximum(1 - sm(w, w + 6, best), 0) * (1 - bed)  # a dark wet margin: the line that makes the water read; me.attributes['damp_soil'].data.foreach_set('value', np.maximum(damp, 0).astype(np.float32))
for key in [a.name for a in me.attributes if a.name.startswith('dens_')]:
    a = np.empty(n, np.float32); me.attributes[key].data.foreach_get('value', a); hd = 0.6 if key in ('dens_tall', 'dens_basal') else 3.0 if key == 'dens_mid' else 5.5  # grass right up to the banks, leaning over the edge
    me.attributes[key].data.foreach_set('value', (a * sm(w + hd, w + hd + 1.5, best)).astype(np.float32))
for o in [o for o in scene.objects if o.name == 'Water - river']: bpy.data.objects.remove(o)
Pv, F = [], []
for i in range(N):
    p = rv[i]; q = rv[min(i + 1, N - 1)]; o_ = rv[max(i - 1, 0)]; t = q - o_; t = t / max(np.linalg.norm(t), 1e-6); nr = np.array([-t[1], t[0]])
    for s_ in (-1, 1): Pv.append((p[0] + nr[0] * wid(i) * s_ * 1.4, p[1] + nr[1] * wid(i) * s_ * 1.4, float(lvl[i])))  # wider than the channel: the banks cut its outline
    if i: F.append((2 * i - 2, 2 * i - 1, 2 * i + 1, 2 * i))
wm = bpy.data.meshes.new('Water - river'); wm.from_pydata(Pv, [], F); wm.update(); _uv = wm.uv_layers.new(name='flow'); _al = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(rv, axis=0), axis=1))])
for _poly in wm.polygons:
    for _li in _poly.loop_indices:
        _vi = wm.loops[_li].vertex_index; _uv.data[_li].uv = (float(_vi % 2), float(_al[_vi // 2] / 10.0))  # u across, v along in tens of metres
wo = bpy.data.objects.new('Water - river', wm); scene.collection.objects.link(wo); wm.materials.append(bpy.data.materials['Simple water - geometry validation'])
for p in wm.polygons: p.use_smooth = True
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'valley_composition_01.blend'))
scene.render.filepath = str(HERE / 'renders' / 'range-river-01.png'); bpy.ops.render.render(write_still=True); print('RR done')
