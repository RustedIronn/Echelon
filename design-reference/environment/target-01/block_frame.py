"""Target 01: a blocked-in frame of the agreed direction (nostalgia and tranquility). Not a finished scene - simple masses only, to agree the
composition, the scale, the colour and the light before anything is built properly.
Layout (from the Seiser Alm wide shot): the camera low in a flowering meadow; a worn path leading to a small lived-in hamlet on a gentle rise at
the left third, sheltered by trees (the Allingham); a calm open middle with two hay huts; a forest edge closing the right side; two characterful
mountains - a blocky massif and a sloping peak - soft and far behind; low warm backlight with haze (the quiet-hour refs).
Run: blender --background --factory-startup --python block_frame.py"""
import bpy, math, numpy as np, mathutils
from pathlib import Path
HERE = Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True); scene = bpy.context.scene
rng = np.random.default_rng(7)
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def vn(x, y, s=0):
    xi, yi = np.floor(x), np.floor(y); xf, yf = x - xi, y - yi; u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    h = lambda a, b: (np.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453) % 1.0
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v
def fbm(x, y, s=0): return 0.5 * vn(x, y, s) + 0.27 * vn(x * 2.1 + 3, y * 2.1, s + 1) + 0.15 * vn(x * 4.3, y * 4.3 + 7, s + 2) + 0.08 * vn(x * 9.1, y * 9.1, s + 3)
def mat(name, rgb, rough=0.9, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough; return m
def grid(name, xs, ys, hfun, material):
    X, Y = np.meshgrid(xs, ys); Z = hfun(X, Y); W, H = len(xs), len(ys)
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1); i = np.arange(W - 1); j = np.arange(H - 1); I, J = np.meshgrid(i, j); a = (J * W + I).ravel()
    faces = np.stack([a, a + 1, a + W + 1, a + W], 1); me = bpy.data.meshes.new(name); me.from_pydata(verts.tolist(), [], faces.tolist()); me.update()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob); me.materials.append(material); return ob

HAMLET = np.array([-48.0, 150.0])  # near enough to read as a home
def ground_h(x, y):
    rise = 7.0 * np.exp(-(((x - HAMLET[0]) / 70) ** 2 + ((y - HAMLET[1]) / 55) ** 2))  # the hamlet's gentle rise
    swell = 2.2 * (fbm(x / 90, y / 90, 1) - 0.5) + 0.006 * np.maximum(y - 60, 0)  # soft swells, the floor rising a little away from us
    right = 18 * sm(150, 420, x - 0.25 * y) * sm(100, 300, y)  # the ground lifting toward the forest on the right
    far = sm(1200, 2600, y) * 60 * fbm(x / 600, y / 600, 4)  # rolling forested foothills toward the mountains
    return rise + swell + right + far

# --- the meadow: saturated summer green, flowers as fine flecks of buttercup yellow, white and pink, denser toward us
meadow = bpy.data.materials.new('Meadow'); meadow.use_nodes = True; nt = meadow.node_tree; N = nt.nodes; L = nt.links.new; bs = N['Principled BSDF']; bs.inputs['Roughness'].default_value = 0.95
tc = N.new('ShaderNodeTexCoord'); vor = N.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 3.5; L(tc.outputs['Object'], vor.inputs['Vector'])
big = N.new('ShaderNodeTexNoise'); big.inputs['Scale'].default_value = 0.012; big.inputs['Detail'].default_value = 3; L(tc.outputs['Object'], big.inputs['Vector'])
grass = N.new('ShaderNodeValToRGB'); grass.color_ramp.elements[0].color = (0.06, 0.24, 0.02, 1); grass.color_ramp.elements[1].color = (0.22, 0.45, 0.03, 1); L(big.outputs['Fac'], grass.inputs[0])
fl = N.new('ShaderNodeValToRGB'); e = fl.color_ramp.elements; e[0].position = 0.0; e[0].color = (1.0, 0.82, 0.05, 1); e[1].position = 0.7; e[1].color = (0.95, 0.42, 0.62, 1); e.new(0.4).color = (0.97, 0.97, 0.9, 1)
fl.color_ramp.interpolation = 'CONSTANT'; L(vor.outputs['Color'], fl.inputs[0]) if False else None
cr = N.new('ShaderNodeSeparateColor'); L(vor.outputs['Color'], cr.inputs[0]); L(cr.outputs[0], fl.inputs[0])
fleck = N.new('ShaderNodeMath'); fleck.operation = 'LESS_THAN'; fleck.inputs[1].default_value = 0.2; L(vor.outputs['Distance'], fleck.inputs[0])
patch = N.new('ShaderNodeTexNoise'); patch.inputs['Scale'].default_value = 0.05; L(tc.outputs['Object'], patch.inputs['Vector'])
pr = N.new('ShaderNodeMapRange'); pr.inputs['From Min'].default_value = 0.35; pr.inputs['From Max'].default_value = 0.55; L(patch.outputs['Fac'], pr.inputs['Value'])
mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; L(fleck.outputs[0], mul.inputs[0]); L(pr.outputs[0], mul.inputs[1])
mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; L(mul.outputs[0], mix.inputs[0]); L(grass.outputs[0], mix.inputs[6]); L(fl.outputs[0], mix.inputs[7]); L(mix.outputs[2], bs.inputs['Base Color'])
ys = np.concatenate([np.linspace(1, 120, 120), np.linspace(122, 600, 160), np.linspace(610, 5000, 160)]); xs = np.linspace(-1500, 1500, 360)
grid('Meadow floor', xs, ys, ground_h, meadow)

# --- the path: worn earth from our feet to the hamlet's gate
path_m = mat('Worn path', (0.55, 0.42, 0.26))
P = []; pts = [(1.2, 4), (2.5, 22), (-2, 48), (-12, 82), (-26, 112), (-38, 135), (-44, 142)]
curve = np.array(pts, float); seg = []
for k in range(len(curve) - 1):
    for t in np.linspace(0, 1, 12, endpoint=False): seg.append(curve[k] * (1 - t) + curve[k + 1] * t)
seg.append(curve[-1]); seg = np.array(seg); F = []; V = []
for i, p in enumerate(seg):
    d = seg[min(i + 1, len(seg) - 1)] - seg[max(i - 1, 0)]; d /= np.linalg.norm(d); nrm = np.array([-d[1], d[0]]); w = 0.4 + 0.15 * (1 - i / len(seg))
    for s in (-1, 1): q = p + nrm * w * s; V.append((q[0], q[1], float(ground_h(np.array([q[0]]), np.array([q[1]]))[0]) + 0.04))
    if i: F.append((2 * i - 2, 2 * i - 1, 2 * i + 1, 2 * i))
me = bpy.data.meshes.new('Path'); me.from_pydata(V, [], F); me.update(); o = bpy.data.objects.new('Path', me); scene.collection.objects.link(o); me.materials.append(path_m)

# --- the hamlet: cream walls, warm terracotta roofs, one chimney smoking; sheltered by round trees and a few spruce
wall = mat('Cream wall', (0.86, 0.80, 0.66)); roof = mat('Terracotta roof', (0.50, 0.20, 0.10)); wood = mat('Dark timber', (0.28, 0.17, 0.09))
def house(x, y, w, d, h, yaw, wall_m=wall, roof_m=roof, chimney=False):
    z = float(ground_h(np.array([x]), np.array([y]))[0])
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z + h / 2)); b = bpy.context.active_object; b.scale = (w, d, h); b.rotation_euler.z = yaw; b.data.materials.append(wall_m)
    me = bpy.data.meshes.new('roof'); r = 0.6
    vs = [(-w / 2 - r, -d / 2 - r, 0), (w / 2 + r, -d / 2 - r, 0), (w / 2 + r, d / 2 + r, 0), (-w / 2 - r, d / 2 + r, 0), (-w / 2 - r, 0, h * 0.75), (w / 2 + r, 0, h * 0.75)]
    me.from_pydata(vs, [], [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5)]); me.update(); ro = bpy.data.objects.new('roof', me); scene.collection.objects.link(ro); me.materials.append(roof_m)
    ro.location = (x, y, z + h); ro.rotation_euler.z = yaw
    if chimney:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x + 0.25 * w * math.cos(yaw), y + 0.25 * w * math.sin(yaw), z + h * 1.7)); c = bpy.context.active_object; c.scale = (0.9, 0.9, 2.4); c.data.materials.append(roof_m)
for (dx, dy, w, d, h, yaw, ch) in ((0, 0, 11, 7, 5.0, 0.15, True), (-17, 9, 8, 6, 4.2, -0.2, False), (14, 13, 9, 6.5, 4.5, 0.35, True), (-6, 22, 7, 6, 4.0, 0.05, False)):
    house(HAMLET[0] + dx, HAMLET[1] + dy, w, d, h, yaw, chimney=ch)
hut_m = mat('Weathered hut', (0.42, 0.29, 0.18))
house(26, 330, 5, 4, 3.2, 0.4, wall_m=hut_m, roof_m=wood); house(-140, 420, 5, 4, 3.0, -0.3, wall_m=hut_m, roof_m=wood)

leaf = mat('Round tree', (0.16, 0.36, 0.06)); leaf2 = mat('Round tree light', (0.32, 0.50, 0.10)); spruce = mat('Spruce', (0.04, 0.14, 0.05))
def round_tree(x, y, r, m):
    z = float(ground_h(np.array([x]), np.array([y]))[0])
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r, location=(x, y, z + r * 1.6)); t = bpy.context.active_object; t.scale = (1, 1, 1.1); t.data.materials.append(m)
    bpy.ops.mesh.primitive_cylinder_add(radius=r * 0.08, depth=r * 1.2, location=(x, y, z + r * 0.6)); bpy.context.active_object.data.materials.append(wood)
def cone_tree(x, y, h, m=spruce):
    z = float(ground_h(np.array([x]), np.array([y]))[0])
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=h * 0.22, depth=h, location=(x, y, z + h / 2 + 0.6)); bpy.context.active_object.data.materials.append(m)
for k in range(16):  # trees wrapped round the hamlet, more behind it than in front
    a = rng.uniform(0.6, 5.8); rr = rng.uniform(18, 46); x = HAMLET[0] + math.cos(a) * rr * 1.2; y = HAMLET[1] + 18 + math.sin(a) * rr
    round_tree(x, y, rng.uniform(4, 7), leaf if rng.random() < 0.6 else leaf2)
for k in range(10):
    cone_tree(HAMLET[0] + rng.uniform(-60, 60), HAMLET[1] + rng.uniform(30, 70), rng.uniform(12, 20))
round_tree(-16, 96, 4.5, leaf2)  # one tree by the path, a stopping point on the way

# --- the forest edge closing the right side: dense dark spruce, ragged edge, single trees stepping out
for k in range(1400):
    y = rng.uniform(60, 1400); edge = 34 + 0.36 * (y - 60) + 14 * math.sin(y / 45.0)
    x = edge + rng.exponential(60) - (rng.uniform(0, 40) if rng.random() < 0.08 else 0)
    if x > 900: continue
    cone_tree(x, y, rng.uniform(14, 26) * (1 + y / 2500))

# --- the mountains: a blocky massif and a sloping peak, far and soft (the Langkofel and Plattkofel shapes)
rock = mat('Far rock', (0.50, 0.52, 0.58), 0.8)
def peaks(x, y):
    # the block: steep walls, a ragged crown
    bx, by = -900.0, 7200.0; u = (x - bx) / 900; v = (y - by) / 700
    block = 1150 * sm(-1.15, -0.75, u) * (1 - sm(0.75, 1.15, u)) * sm(-1.2, -0.6, v) * (1 - sm(0.6, 1.2, v)) * (0.86 + 0.28 * fbm(x / 160, y / 160, 9))
    # the sloping peak: a long ramp rising to the left to a summit, a steep fall beyond it
    px, py = 1500.0, 7800.0; s = (x - px) / 1700; w = np.abs(y - py) / 800
    ramp = np.where(s < 0, 1000 * (1 + s * 1.6), 1000 * (1 - s)) * (1 - sm(0.5, 1.0, w)); ramp = np.maximum(ramp, 0) * (0.9 + 0.2 * fbm(x / 220, y / 220, 12))
    foot = 260 * fbm(x / 900, y / 900, 13) * sm(4800, 6000, y)
    return np.maximum(np.maximum(block, ramp), foot)
grid('Mountains', np.linspace(-5000, 6000, 300), np.linspace(5000, 10000, 160), peaks, rock)

# --- camera low in the meadow, the frame the app shows (1864 x 727)
cd = bpy.data.cameras.new('Hero'); cd.sensor_fit = 'HORIZONTAL'; cd.angle = math.radians(64); cd.clip_end = 30000
cam = bpy.data.objects.new('Hero camera', cd); scene.collection.objects.link(cam); cam.location = (0, 0, 1.5); cam.rotation_euler = (math.radians(91.5), 0, math.radians(3)); scene.camera = cam
scene.render.resolution_x, scene.render.resolution_y = 1864, 727

# --- the quiet hour: a low warm sun ahead and to the left (backlight), soft sky, haze
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN')); scene.collection.objects.link(sun); sun.data.energy = 4.5; sun.data.color = (1.0, 0.86, 0.66); sun.data.angle = math.radians(2)
el, az = math.radians(11), math.radians(-28); d = mathutils.Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
sun.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
world = bpy.data.worlds.new('Sky'); scene.world = world; world.use_nodes = True; wn = world.node_tree; sky = wn.nodes.new('ShaderNodeTexSky'); bg = wn.nodes['Background']
try: sky.sky_type = 'NISHITA'
except Exception: pass
sky.sun_elevation = el; sky.sun_rotation = math.atan2(d.x, d.y) * -1 + math.pi / 2
try: sky.sun_disc = True; sky.air_density = 2.2; sky.dust_density = 3.0
except Exception: pass
wn.links.new(sky.outputs[0], bg.inputs[0]); bg.inputs['Strength'].default_value = 0.35
scene.view_settings.view_transform = 'AgX'
try: scene.view_settings.look = 'AgX - Punchy'
except Exception: pass
scene.view_settings.exposure = -0.2
scene.render.engine = 'CYCLES'; scene.cycles.samples = 48; scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'OPTIX'; prefs.get_devices(); [setattr(x, 'use', True) for x in prefs.devices]; scene.cycles.device = 'GPU'
except Exception as e: print('BLOCK gpu', e)
# haze: the mist pass mixed toward a warm horizon colour (the sky keeps its own)
scene.view_layers[0].use_pass_mist = True; world.mist_settings.start = 250; world.mist_settings.depth = 11000; world.mist_settings.falloff = 'QUADRATIC'
tree = bpy.data.node_groups.new('Haze', 'CompositorNodeTree'); scene.compositing_node_group = tree; T = tree.nodes; TL = tree.links.new
rl = T.new('CompositorNodeRLayers'); out = T.new('NodeGroupOutput'); tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
lt = T.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = 0.999; TL(rl.outputs['Mist'], lt.inputs[0])
k = T.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = 0.5; TL(rl.outputs['Mist'], k.inputs[0])
k2 = T.new('ShaderNodeMath'); k2.operation = 'MULTIPLY'; TL(k.outputs[0], k2.inputs[0]); TL(lt.outputs[0], k2.inputs[1])
mx = T.new('ShaderNodeMix'); mx.data_type = 'RGBA'; TL(k2.outputs[0], mx.inputs[0]); TL(rl.outputs['Image'], mx.inputs[6]); mx.inputs[7].default_value = (0.98, 0.86, 0.66, 1); TL(mx.outputs[2], out.inputs[0])
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'block_frame.blend'))
scene.render.filepath = str(HERE / 'block-frame.png'); bpy.ops.render.render(write_still=True); print('BLOCK done')
