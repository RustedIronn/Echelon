"""Valley composition 01, step 2: the approved scene's own terrain material, water, world and sun on the valley's land.
The terrain material ('Sage meadow') is driven by attributes; here they are computed from the land by rule (slope, height, water)."""
import bpy, json, math, numpy as np, mathutils
from pathlib import Path
HERE = Path(__file__).resolve().parent; MASTER = HERE.parent / 'alpine-composition-01' / 'echelon_alpine_composition_01.blend'
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'valley_composition_01.blend'))
scene = bpy.context.scene
L = json.loads((HERE / 'valley-layout.json').read_text())

with bpy.data.libraries.load(str(MASTER), link=False) as (src, dst):
    dst.materials = [m for m in src.materials if m in ('Sage meadow', 'Simple water - geometry validation')]
    dst.worlds = ['Simple blue daylight']
meadow = bpy.data.materials['Sage meadow']; water_mat = bpy.data.materials['Simple water - geometry validation']
scene.world = bpy.data.worlds['Simple blue daylight']

def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def vnoise(x, y, seed=0):
    xi, yi = np.floor(x), np.floor(y); xf, yf = x - xi, y - yi; u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    h = lambda a, b: (np.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453) % 1.0
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v
def fbm(x, y, seed=0): return 0.5 * vnoise(x, y, seed) + 0.3 * vnoise(x * 2.1 + 5, y * 2.1, seed) + 0.2 * vnoise(x * 4.3, y * 4.3 + 9, seed)

import sys; sys.path.insert(0, str(HERE)); from common import route
river = route()  # valley x, z: the new course
rv = np.stack([river[:, 0], -river[:, 1]], axis=1)  # Blender x, y
lake = L['lake']
def water_distance(px, py):
    # distance to the river course (polyline) in metres, by chunks
    best = np.full(px.shape, 1e9)
    a = rv[:-1]; b = rv[1:]
    for k in range(0, len(a), 40):
        A = a[k:k + 40][None, :, :]; B = b[k:k + 40][None, :, :]; P = np.stack([px, py], axis=1)[:, None, :]
        AB = B - A; t = np.clip(((P - A) * AB).sum(-1) / np.maximum((AB * AB).sum(-1), 1e-9), 0, 1); Q = A + AB * t[..., None]
        best = np.minimum(best, np.sqrt(((P - Q) ** 2).sum(-1)).min(axis=1))
    return best

for ob in [o for o in scene.objects if o.type == 'MESH' and o.name.startswith('Valley')]:
    me = ob.data; n = len(me.vertices)
    co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    me.calc_normals_split() if hasattr(me, 'calc_normals_split') else None
    nr = np.empty(n * 3, np.float32); me.vertices.foreach_get('normal', nr); nr = nr.reshape(-1, 3)
    x, y, h = co[:, 0].astype(np.float64), co[:, 1].astype(np.float64), co[:, 2].astype(np.float64); slope = 1 - np.clip(nr[:, 2], 0, 1)
    r = np.hypot(x, y)
    dw = np.where(r < 1600, water_distance(x, y), 1e9)
    inlake = h < 0.02
    rock = sm(0.42, 0.62, slope) * sm(30, 90, h) + sm(1100, 1500, h) * sm(0.25, 0.45, slope)
    snow = sm(1450, 1750, h + 250 * (fbm(x / 300, y / 300) - 0.5)) * (1 - sm(0.55, 0.85, slope))
    talus = sm(0.22, 0.42, slope) * sm(350, 800, h) * (1 - rock)
    bed = np.maximum(1 - sm(2.0, 5.5, dw), inlake.astype(np.float64))
    damp = np.maximum(1 - sm(4, 22, dw), 1 - sm(0.2, 1.4, h)) * (1 - bed)
    vigor = np.clip(0.35 + 0.5 * fbm(x / 60, y / 60, 3) + 0.25 * damp, 0, 1)
    for name, val in (('alpine_rock', rock), ('alpine_snow', snow), ('mountain_talus', talus), ('streambed', bed), ('damp_soil', damp), ('meadow_vigor', vigor), ('tree_habitat_soil', np.zeros(n))):
        if name in me.attributes: me.attributes.remove(me.attributes[name])
        at = me.attributes.new(name, 'FLOAT', 'POINT'); at.data.foreach_set('value', np.clip(val, 0, 1).astype(np.float32))
    me.materials.clear(); me.materials.append(meadow)

# water: the still lake at its level (the terrain hides it outside the bowl) and the river as a ribbon in its channel
for o in [o for o in scene.objects if o.name.startswith('Water')]: bpy.data.objects.remove(o)
c, s_ = math.cos(lake['rot']), math.sin(lake['rot'])
bpy.ops.mesh.primitive_circle_add(vertices=128, radius=1, fill_type='NGON', location=(lake['x'], -lake['z'], 0.0))
lk = bpy.context.active_object; lk.name = 'Water - lake'; lk.scale = (lake['rx'] * 1.5, lake['rz'] * 1.5, 1); lk.rotation_euler = (0, 0, lake['rot']); lk.data.materials.append(water_mat)
P, F = [], []; N = len(river); ry = [0.0] * N; yprev = 1e9  # the real ribbon is built by build_range_river.py
for i in range(N):
    p = rv[i]; q = rv[min(i + 1, N - 1)]; o = rv[max(i - 1, 0)]; t = q - o; t = t / max(np.linalg.norm(t), 1e-6); nrm = np.array([-t[1], t[0]])
    w = 3.2 + (5.5 - 3.2) * i / N
    z = min(yprev, ry[i] + 0.35); yprev = z
    for k in (-1, 1): P.append((p[0] + nrm[0] * w * k, p[1] + nrm[1] * w * k, z))
    if i: F.append((2 * i - 2, 2 * i - 1, 2 * i + 1, 2 * i))
me = bpy.data.meshes.new('Water - river'); me.from_pydata(P, [], F); me.update(); rob = bpy.data.objects.new('Water - river', me); scene.collection.objects.link(rob); me.materials.append(water_mat)

# sun from the approved scene, aimed as the valley's noon (ahead, a little left, 26 degrees up)
sun = scene.objects['Sun']; sun.data.energy = 3.25
scene.view_settings.view_transform = 'AgX'
try: scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception: pass
scene.view_settings.exposure = 0.1
scene.render.engine = 'CYCLES'; scene.cycles.samples = 48; scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'OPTIX'; prefs.get_devices(); [setattr(d, 'use', True) for d in prefs.devices]; scene.cycles.device = 'GPU'
except Exception as e: print('SKIN gpu', e)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'valley_composition_01.blend'))
scene.render.filepath = str(HERE / 'renders' / 'skin-01.png'); bpy.ops.render.render(write_still=True); print('SKIN done')
