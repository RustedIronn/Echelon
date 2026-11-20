"""Target 01, the agreed composition with the real assets: the approved scene's terrain material, its grass patches, its flower species, spruce,
larch and alder, its sky; the valley's houses; the approved range set far behind. Composition first: the same layout as block_frame.py.
Run: blender --background --factory-startup --python build_real.py"""
import bpy, math, json, numpy as np, mathutils
from pathlib import Path
HERE = Path(__file__).resolve().parent; VC = HERE.parent / 'valley-composition-01'; MASTER = HERE.parent / 'alpine-composition-01' / 'echelon_alpine_composition_01.blend'
bpy.ops.wm.read_factory_settings(use_empty=True); scene = bpy.context.scene
rng = np.random.default_rng(7)
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def vn(x, y, s=0):
    xi, yi = np.floor(x), np.floor(y); xf, yf = x - xi, y - yi; u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    h = lambda a, b: (np.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453) % 1.0
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v
def fbm(x, y, s=0): return 0.5 * vn(x, y, s) + 0.27 * vn(x * 2.1 + 3, y * 2.1, s + 1) + 0.15 * vn(x * 4.3, y * 4.3 + 7, s + 2) + 0.08 * vn(x * 9.1, y * 9.1, s + 3)

# ---------------------------------------------------------------- the layout (as agreed in the block-in)
HAMLET = np.array([-48.0, 150.0])
def ground_h(x, y):
    rise = 7.0 * np.exp(-(((x - HAMLET[0]) / 70) ** 2 + ((y - HAMLET[1]) / 55) ** 2))
    swell = 2.2 * (fbm(x / 90, y / 90, 1) - 0.5) + 0.006 * np.maximum(y - 60, 0)
    right = 18 * sm(150, 420, x - 0.25 * y) * sm(100, 300, y)
    far = sm(1200, 2600, y) * 60 * fbm(x / 600, y / 600, 4)
    return rise + swell + right + far
PATH = np.array([(1.2, 4), (2.5, 22), (-2, 48), (-12, 82), (-26, 112), (-38, 135), (-44, 142)], float)
def polyd(px, py, P):
    best = np.full(px.shape, 1e9); a, b = P[:-1], P[1:]; Pt = np.stack([px, py], 1)[:, None, :]
    AB = (b - a)[None]; t = np.clip(((Pt - a[None]) * AB).sum(-1) / np.maximum((AB * AB).sum(-1), 1e-9), 0, 1); return np.sqrt(((Pt - (a[None] + AB * t[..., None])) ** 2).sum(-1)).min(1)
def forest_edge(y): return 34 + 0.36 * (y - 60) + 14 * np.sin(y / 45.0)

# ---------------------------------------------------------------- assets
with bpy.data.libraries.load(str(MASTER), link=False) as (s, d): d.materials = ['Sage meadow']; d.worlds = ['Simple blue daylight']
meadow_mat = bpy.data.materials['Sage meadow']; scene.world = bpy.data.worlds['Simple blue daylight']
with bpy.data.libraries.load(str(VC / 'valley-assets.blend'), link=False) as (s, d): d.objects = [n for n in s.objects if n.startswith('PATCH') or n.startswith('PLANT')]
lib = bpy.data.collections.new('Library'); scene.collection.children.link(lib)
for o in d.objects: lib.objects.link(o); o.location = (0, 0, -500)
lib.hide_render = True
A = lambda n: bpy.data.objects[n]

# ---------------------------------------------------------------- the ground, with the attributes the approved material reads
xs = np.concatenate([np.linspace(-1500, -220, 70), np.linspace(-218, 218, 437), np.linspace(220, 1500, 70)])
ys = np.concatenate([np.linspace(1, 220, 330), np.linspace(222, 900, 170), np.linspace(910, 6000, 130)])
X, Y = np.meshgrid(xs, ys); Z = ground_h(X, Y); W, H = len(xs), len(ys)
verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1); I, J = np.meshgrid(np.arange(W - 1), np.arange(H - 1)); a = (J * W + I).ravel()
me = bpy.data.meshes.new('Meadow floor'); me.from_pydata(verts.tolist(), [], np.stack([a, a + 1, a + W + 1, a + W], 1).tolist()); me.update()
for p in me.polygons: p.use_smooth = True
ground = bpy.data.objects.new('Meadow floor', me); scene.collection.objects.link(ground); me.materials.append(meadow_mat)
x, y, h = verts[:, 0], verts[:, 1], verts[:, 2]; n = len(x); d = np.hypot(x, y)
pathd = polyd(x, y, PATH); path = 1 - sm(0.5, 1.3, pathd)
plot = np.exp(-(((x - HAMLET[0]) / 30) ** 2 + ((y - HAMLET[1] - 8) / 22) ** 2))
fe = forest_edge(y); inwood = sm(-6, 10, x - fe)
view = (1 - sm(36, 44, np.degrees(np.abs(np.arctan2(x, y))))) * (y > 0)
def setattr_(k, v):
    if k in me.attributes: me.attributes.remove(me.attributes[k])
    me.attributes.new(k, 'FLOAT', 'POINT').data.foreach_set('value', np.clip(v, 0, 1).astype(np.float32))
setattr_('meadow_vigor', 0.55 + 0.35 * fbm(x / 50, y / 50, 3)); setattr_('streambed', path * 0.9); setattr_('damp_soil', 0 * x); setattr_('alpine_rock', 0 * x); setattr_('alpine_snow', 0 * x)
setattr_('mountain_talus', 0 * x); setattr_('tree_habitat_soil', inwood * 0.7)
open_ = (1 - path) * (1 - inwood) * view
for name, lo, hi in (('tall', 0, 60), ('basal', 0, 60), ('mid', 45, 200), ('hill', 180, 520)):
    setattr_('dens_' + name, open_ * sm(lo - 8, lo + 8, d) * (1 - sm(hi - 15, hi + 15, d)) * (1 - 0.7 * plot))
# flowers: buttercup-yellow leads (the dandelion model), white marguerite in sweeps, pink in clusters, clover low; densest toward us
fl = open_ * (1 - plot) * (1 - sm(150, 240, d))
setattr_('fl_yellow', fl * (0.25 + 0.75 * sm(0.42, 0.62, fbm(x / 30, y / 24, 21))))
setattr_('fl_white', fl * (0.06 + 0.9 * sm(0.52, 0.7, fbm(x / 55, y / 40, 11))))
setattr_('fl_pink', fl * (0.03 + 0.8 * sm(0.6, 0.75, fbm(x / 16, y / 13, 37))))
setattr_('fl_clover', fl * (0.05 + 0.5 * sm(0.5, 0.68, fbm(x / 24, y / 20, 51))))
# the forest edge closing the right side, and single trees stepping out of it
setattr_('forest', sm(-4, 12, x - fe) * view * sm(50, 70, y) * (1 - sm(2500, 3500, y)))
setattr_('edge_trees', sm(-30, -6, x - fe) * (1 - sm(-6, 0, x - fe)) * sm(0.55, 0.7, fbm(x / 20, y / 20, 61)) * view * sm(50, 70, y))

def scatter(name, attr, plant, spacing, density, smin, smax, tilt=0.06, collection=None):
    ng = bpy.data.node_groups.new(name, 'GeometryNodeTree'); ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry'); ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = ng.nodes; Lk = ng.links.new; gi = N.new('NodeGroupInput'); go = N.new('NodeGroupOutput')
    dist = N.new('GeometryNodeDistributePointsOnFaces'); dist.distribute_method = 'POISSON'; dist.inputs['Distance Min'].default_value = spacing; dist.inputs['Density Max'].default_value = density
    at = N.new('GeometryNodeInputNamedAttribute'); at.data_type = 'FLOAT'; at.inputs['Name'].default_value = attr; Lk(gi.outputs[0], dist.inputs['Mesh']); Lk(at.outputs[0], dist.inputs['Density Factor'])
    info = N.new('GeometryNodeObjectInfo'); info.inputs['Object'].default_value = plant; info.inputs['As Instance'].default_value = True; info.transform_space = 'ORIGINAL'
    inst = N.new('GeometryNodeInstanceOnPoints'); Lk(dist.outputs['Points'], inst.inputs['Points']); Lk(info.outputs['Geometry'], inst.inputs['Instance'])
    rot = N.new('FunctionNodeRandomValue'); rot.data_type = 'FLOAT_VECTOR'; v = [s for s in rot.inputs if s.type == 'VECTOR']; v[0].default_value = (-tilt, -tilt, 0); v[1].default_value = (tilt, tilt, 6.2832)
    e2r = N.new('FunctionNodeEulerToRotation'); Lk([s for s in rot.outputs if s.type == 'VECTOR'][0], e2r.inputs[0]); Lk(e2r.outputs[0], inst.inputs['Rotation'])
    sc = N.new('FunctionNodeRandomValue'); sc.data_type = 'FLOAT'; f = [s for s in sc.inputs if s.type == 'VALUE']; f[0].default_value = smin; f[1].default_value = smax; Lk([s for s in sc.outputs if s.type == 'VALUE'][0], inst.inputs['Scale'])
    join = N.new('GeometryNodeJoinGeometry'); Lk(gi.outputs[0], join.inputs[0]); Lk(inst.outputs[0], join.inputs[0]); Lk(join.outputs[0], go.inputs[0])
    mod = ground.modifiers.new(name, 'NODES'); mod.node_group = ng
for nm, attr, plant, sp, de, a_, b_, tl in (
        ('Grass tall', 'dens_tall', 'PATCH grass tall', 1.2, 3.2 / 16, 0.85, 1.15, 0.0), ('Grass basal', 'dens_basal', 'PATCH grass basal', 1.2, 1.6 / 16, 0.85, 1.15, 0.0),
        ('Grass mid', 'dens_mid', 'PATCH grass mid', 1.8, 3.2 / 36, 0.85, 1.15, 0.0), ('Grass hill', 'dens_hill', 'PATCH grass hill', 2.4, 3.2 / 64, 0.85, 1.15, 0.0),
        ('Flowers yellow', 'fl_yellow', 'PLANT Dandelion', 0.09, 22.0, 1.4, 2.2, 0.12), ('Flowers white', 'fl_white', 'PLANT Marguerite', 0.1, 14.0, 1.0, 1.5, 0.12),
        ('Flowers pink', 'fl_pink', 'PLANT Carthusian Pink', 0.12, 9.0, 0.9, 1.3, 0.12), ('Flowers clover', 'fl_clover', 'PLANT Red Clover', 0.12, 6.0, 0.8, 1.2, 0.12),
        ('Forest spruce', 'forest', 'PLANT Norway Spruce', 4.5, 1 / 22, 0.8, 1.5, 0.04), ('Forest larch', 'forest', 'PLANT Larch', 7.0, 1 / 140, 0.7, 1.2, 0.04),
        ('Edge trees', 'edge_trees', 'PLANT Norway Spruce', 7.0, 1 / 90, 0.6, 1.2, 0.04)):
    scatter(nm, attr, A(plant), sp, de, a_, b_, tl)

# ---------------------------------------------------------------- the hamlet: the valley's houses, turned to us, wrapped in alder and spruce
before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=str(VC / 'valley-hamlet.glb')); new = [o for o in bpy.data.objects if o not in before]
root = [o for o in new if o.name.startswith('export:hamlet')][0]
keep = {'Node_179': (0, 6, 0.2), 'Node_260': (-22, 14, -0.25), 'Node_439': (18, 16, 0.3), 'Node_354': (-6, 30, 0.0)}  # chapel, two houses, a farmhouse
for c in list(root.children):
    if c.name not in keep:
        for o in [c] + list(c.children_recursive): bpy.data.objects.remove(o)
        continue
    dx, dy, turn = keep[c.name]; p = c.matrix_world.translation.copy(); q = mathutils.Vector((HAMLET[0] + dx, HAMLET[1] + dy))
    face = lambda v: math.atan2(-v.x, v.y); yaw = face(q) - face(p.xy) + turn
    c.matrix_world = mathutils.Matrix.Translation((q.x, q.y, 0)) @ mathutils.Matrix.Rotation(yaw, 4, 'Z') @ mathutils.Matrix.Translation((-p.x, -p.y, 0)) @ c.matrix_world
    bpy.context.view_layer.update(); gz = float(ground_h(np.array([q.x]), np.array([q.y]))[0]); c.matrix_world.translation.z += gz + 0.05 - c.matrix_world.translation.z
def place(obj, xx, yy, s, rotz=None):
    c = obj.copy(); scene.collection.objects.link(c); z = float(ground_h(np.array([xx]), np.array([yy]))[0]); c.location = (xx, yy, z - 0.1); c.scale = (s, s, s); c.rotation_euler = (0, 0, rng.uniform(0, 6.28) if rotz is None else rotz); c.hide_render = False
for k in range(14):  # alder round the hamlet, more behind than in front
    ang = rng.uniform(0.5, 5.9); rr = rng.uniform(20, 48); place(A('PLANT Black Alder'), HAMLET[0] + math.cos(ang) * rr * 1.25, HAMLET[1] + 16 + math.sin(ang) * rr, rng.uniform(0.6, 1.0))
for k in range(8): place(A('PLANT Norway Spruce'), HAMLET[0] + rng.uniform(-60, 60), HAMLET[1] + rng.uniform(32, 75), rng.uniform(0.8, 1.3))
place(A('PLANT Black Alder'), -16, 96, 0.8)  # the tree by the path

# ---------------------------------------------------------------- the mountains: the approved range, far and lower, soft in the haze
with bpy.data.libraries.load(str(VC / 'valley-range.blend'), link=False) as (s, d): d.objects = ['RANGE approved']
rg = d.objects[0]; scene.collection.objects.link(rg); rg.location = (300, 3500, -120); rg.scale = (1.0, 1.0, 0.7)
for p in rg.data.polygons: p.use_smooth = True

# ---------------------------------------------------------------- camera, light, air (as in the block-in)
cd = bpy.data.cameras.new('Hero'); cd.sensor_fit = 'HORIZONTAL'; cd.angle = math.radians(64); cd.clip_end = 40000
cam = bpy.data.objects.new('Hero camera', cd); scene.collection.objects.link(cam); cam.location = (0, 0, 1.5); cam.rotation_euler = (math.radians(91.5), 0, math.radians(3)); scene.camera = cam
scene.render.resolution_x, scene.render.resolution_y = 1864, 727
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN')); scene.collection.objects.link(sun); sun.data.energy = 4.0; sun.data.color = (1.0, 0.88, 0.7); sun.data.angle = math.radians(1.5)
el, az = math.radians(14), math.radians(-35); dv = mathutils.Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))); sun.rotation_euler = (-dv).to_track_quat('-Z', 'Y').to_euler()
scene.view_settings.view_transform = 'AgX'
try: scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception: pass
scene.view_settings.exposure = 0.15
scene.render.engine = 'CYCLES'; scene.cycles.samples = 48; scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'OPTIX'; prefs.get_devices(); [setattr(x_, 'use', True) for x_ in prefs.devices]; scene.cycles.device = 'GPU'
except Exception as e: print('REAL gpu', e)
scene.view_layers[0].use_pass_mist = True; scene.world.mist_settings.start = 250; scene.world.mist_settings.depth = 14000; scene.world.mist_settings.falloff = 'QUADRATIC'
tree = bpy.data.node_groups.new('Haze', 'CompositorNodeTree'); scene.compositing_node_group = tree; T = tree.nodes; TL = tree.links.new
rl = T.new('CompositorNodeRLayers'); out = T.new('NodeGroupOutput'); tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
lt = T.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = 0.999; TL(rl.outputs['Mist'], lt.inputs[0])
k = T.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = 0.55; TL(rl.outputs['Mist'], k.inputs[0])
k2 = T.new('ShaderNodeMath'); k2.operation = 'MULTIPLY'; TL(k.outputs[0], k2.inputs[0]); TL(lt.outputs[0], k2.inputs[1])
mx = T.new('ShaderNodeMix'); mx.data_type = 'RGBA'; TL(k2.outputs[0], mx.inputs[0]); TL(rl.outputs['Image'], mx.inputs[6]); mx.inputs[7].default_value = (0.86, 0.85, 0.82, 1); TL(mx.outputs[2], out.inputs[0])
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'target_real.blend'))
scene.render.filepath = str(HERE / 'real-frame.png'); bpy.ops.render.render(write_still=True); print('REAL done')
