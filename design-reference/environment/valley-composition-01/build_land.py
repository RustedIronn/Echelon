"""Valley composition 01, step 1: the land (the new valley's terrain at true scale), the hero camera and daylight, with a clay material.
Run: blender --background --factory-startup --python build_land.py
Three.js world (x, y up, z toward the viewer) maps to Blender (x, -z, y)."""
import bpy, json, math, numpy as np
from pathlib import Path
HERE = Path(__file__).resolve().parent
ASSETS = Path('D:/Projects/Echelon/.claude/worktrees/perf-pass/public/assets/environment/alpine-prototype')
OUT = HERE / 'valley_composition_01.blend'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene; scene.name = 'Valley'
scene.unit_settings.system = 'METRIC'

def mesh_from(name, verts, faces):
    me = bpy.data.meshes.new(name); me.from_pydata(verts.tolist() if hasattr(verts, 'tolist') else verts, [], faces.tolist() if hasattr(faces, 'tolist') else faces); me.update()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob); return ob

# near ground: a regular 2 m grid, valley metres
nm = json.loads((ASSETS / 'near-heights.json').read_text()); nh = np.fromfile(ASSETS / 'near-heights.bin', dtype=np.float32).reshape(nm['h'], nm['w'])
W, H, C = nm['w'], nm['h'], nm['cell']
import sys; sys.path.insert(0, str(HERE)); from common import polyline_distance
L0 = json.loads((HERE / 'valley-layout.json').read_text()); old = np.array(L0['river'], float)
_xs = nm['minX'] + np.arange(W) * C; _zs = nm['minZ'] + np.arange(H) * C; _X, _Z = np.meshgrid(_xs, _zs)
_d, _ = polyline_distance(_X.ravel(), _Z.ravel(), old); _d = _d.reshape(H, W)
from numpy.lib.stride_tricks import sliding_window_view as _sw
_pad = np.pad(nh, 8, mode='edge'); _blur = _sw(_pad, (17, 17)).max(axis=(2, 3)) * 0.5 + _sw(_pad, (17, 17)).mean(axis=(2, 3)) * 0.5
_k = np.clip(1 - (_d - 8) / 10, 0, 1); _k = _k * _k * (3 - 2 * _k); nh = np.where(nh < 0.0, nh, nh * (1 - _k) + np.maximum(nh, _blur) * _k)  # the old river's trench filled (the lake bed stays)
print('BUILD trench filled', int((_k > 0).sum()))
# the hamlet's terrace was a flat-topped plateau standing alone in the meadow: flattened back into the floor ...
def _sm(a, b, x): q = np.clip((x - a) / (b - a), 0, 1); return q * q * (3 - 2 * q)
_m = _sm(-25, 0, np.minimum.reduce([_X - 10, 170 - _X, -320 - _Z, _Z + 500]))
nh = nh * (1 - _m) + np.minimum(nh, 6.5 + 0.004 * (-_Z - 320)) * _m
# ... and a shoulder grows instead off the right-hand valley side: a long, rounded spur running down and in toward the middle of the view,
# highest where it leaves the hillside, its top uneven, its toe dying away into the meadow, slopes of 10 to 15 degrees
A, B = np.array([480.0, -335.0]), np.array([95.0, -400.0]); AB = B - A; LAB = np.linalg.norm(AB); U = AB / LAB; Nn = np.array([-U[1], U[0]])
_rel_x, _rel_z = _X - A[0], _Z - A[1]; _s = (_rel_x * U[0] + _rel_z * U[1]) / LAB; _d = np.abs(_rel_x * Nn[0] + _rel_z * Nn[1])
def _vn(x, y):
    xi, yi = np.floor(x), np.floor(y); xf, yf = x - xi, y - yi; u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf); hh = lambda a, b: (np.sin(a * 127.1 + b * 311.7) * 43758.5453) % 1.0
    return (hh(xi, yi) * (1 - u) + hh(xi + 1, yi) * u) * (1 - v) + (hh(xi, yi + 1) * (1 - u) + hh(xi + 1, yi + 1) * u) * v
_sc = np.clip(_s, 0, 1); _top = 36 * (1 - _sc) ** 0.85 + 3.0  # metres above the floor along the spine
_hw = 120 * (1 - _sc) + 55 * _sc  # half-width across it
_bump = np.clip(1 - (_d / _hw) ** 2, 0, 1) ** 2 * _top * (1 - _sm(1.0, 1.25, _s)) * _sm(-0.15, 0.0, _s)
_bump *= 0.85 + 0.3 * _vn(_X / 45, _Z / 45)  # an uneven back, no flat terrace
nh = np.maximum(nh, nh + _bump) if True else nh
print('BUILD shoulder', round(float(_bump.max()), 1))
xs = nm['minX'] + np.arange(W) * C; zs = nm['minZ'] + np.arange(H) * C
X, Z = np.meshgrid(xs, zs)
verts = np.stack([X.ravel(), -Z.ravel(), nh.ravel()], axis=1)
i = np.arange(W - 1); j = np.arange(H - 1); I, J = np.meshgrid(i, j); a = (J * W + I).ravel()
faces = np.stack([a, a + 1, a + W + 1, a + W], axis=1)
near = mesh_from('Valley ground (near, 2 m)', verts, faces)
x0, x1, z0, z1 = xs[0] + 4, xs[-1] - 4, zs[0] + 4, zs[-1] - 4

# far land: the polar bake round the camera, minus what the near grid covers
fm = json.loads((ASSETS / 'valley-far.json').read_text()); fh = np.fromfile(ASSETS / 'valley-far.bin', dtype=np.float32).reshape(fm['nr'], fm['na'])
NA, NR = fm['na'], fm['nr']
r = fm['r0'] * (fm['r1'] / fm['r0']) ** (np.arange(NR) / (NR - 1)); ang = np.radians(fm['a0'] + (fm['a1'] - fm['a0']) * np.arange(NA) / (NA - 1))
RR, AA = np.meshgrid(r, ang, indexing='ij')
fx = np.sin(AA) * RR; fz = -np.cos(AA) * RR
fverts = np.stack([fx.ravel(), -fz.ravel(), fh.ravel()], axis=1)
inside = ((fx > x0) & (fx < x1) & (fz > z0) & (fz < z1)).ravel()
i = np.arange(NA - 1); j = np.arange(NR - 1); I, J = np.meshgrid(i, j); a = (J * NA + I).ravel()
quads = np.stack([a, a + 1, a + NA + 1, a + NA], axis=1)
keep = ~inside[quads].all(axis=1)
far = mesh_from('Valley far land (polar)', fverts, quads[keep])

clay = bpy.data.materials.new('Clay'); clay.use_nodes = True; bsdf = clay.node_tree.nodes['Principled BSDF']; bsdf.inputs['Base Color'].default_value = (0.32, 0.36, 0.26, 1); bsdf.inputs['Roughness'].default_value = 0.95
for ob in (near, far): ob.data.materials.append(clay)

# hero camera: low in the meadow (common.py CAM), 32 degree vertical view
cam_data = bpy.data.cameras.new('Hero'); cam_data.sensor_fit = 'VERTICAL'; cam_data.angle_y = math.radians(32); cam_data.clip_start = 0.5; cam_data.clip_end = 40000
cam = bpy.data.objects.new('Hero camera', cam_data); scene.collection.objects.link(cam); from common import CAM, CAM_EYE, CAM_YAW
_ci, _cj = int(round((CAM[0] - nm['minX']) / C)), int(round((-CAM[1] - nm['minZ']) / C)); _gz = float(nh[_cj, _ci])
cam.location = (CAM[0], CAM[1], _gz + CAM_EYE); cam.rotation_euler = (math.radians(90 + 3.0), 0, -math.radians(CAM_YAW));  # low in the meadow, the horizon a little below the middle: sky and meadow leave room for the UI
scene.camera = cam
scene.render.resolution_x, scene.render.resolution_y = 1864, 727

# daylight: a sun ahead and a little left (the valley's noon), with the physical sky
sun_el, sun_az = math.radians(26), math.radians(-3.5)
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN')); scene.collection.objects.link(sun); sun.data.energy = 4.0; sun.data.angle = math.radians(0.55)
d = (math.sin(sun_az) * math.cos(sun_el), math.cos(sun_az) * math.cos(sun_el), math.sin(sun_el))  # toward the sun, Blender axes (+y ahead)
sun.rotation_euler = (0, 0, 0); import mathutils; sun.rotation_euler = mathutils.Vector(d).to_track_quat('Z', 'Y').to_euler()
world = bpy.data.worlds.new('Sky'); scene.world = world; world.use_nodes = True; nt = world.node_tree; bg = nt.nodes['Background']
sky = nt.nodes.new('ShaderNodeTexSky'); sky.sun_elevation = sun_el; sky.sun_rotation = math.atan2(d[0], d[1]) * -1 + math.pi / 2 if False else math.atan2(-d[0], d[1]); nt.links.new(sky.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 0.35
try: sky.sun_disc = False
except Exception: pass
scene.view_settings.view_transform = 'AgX'
scene.render.engine = 'BLENDER_EEVEE'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT))
scene.render.filepath = str(HERE / 'renders' / 'land-clay.png'); (HERE / 'renders').mkdir(exist_ok=True)
bpy.ops.render.render(write_still=True)
print('BUILD done', len(near.data.vertices), len(far.data.vertices), len(far.data.polygons))
