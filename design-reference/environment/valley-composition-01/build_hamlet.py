"""Valley composition 01, step 6: the composition's heart (target 01 - one emotionally strong frame, not an asset lineup).
- The hamlet: one compact cluster at the right third, staggered in depth and turned at different angles (a place, not a facade), the chapel
  set back among the houses with trees in front of it, and one small outbuilding apart.
- Trees wrap it: alder in front overlapping the houses, round its sides, spruce at its back - sheltered, half hidden.
- A narrow worn path that starts clearly at our feet and leads gently up to it.
- A calm, reflective pond in the near left: the still water the frame rests on.
The valley's houses are exported from the WebGL valley (valley-hamlet.glb). Grass, flowers and forest are kept off the plots, the path and the pond."""
import bpy, math, mathutils, numpy as np
from pathlib import Path
HERE = Path(__file__).resolve().parent
import sys; sys.path.insert(0, str(HERE)); from common import polyline_distance, CAM, CAM_YAW
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'valley_composition_01.blend')); scene = bpy.context.scene
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
for c in [c for c in bpy.data.collections if c.name == 'Hamlet']:
    for o in list(c.objects): bpy.data.objects.remove(o)
    bpy.data.collections.remove(c)
for o in [o for o in bpy.data.objects if o.name.startswith('Water - pond')]: bpy.data.objects.remove(o)
col = bpy.data.collections.new('Hamlet'); scene.collection.children.link(col)
before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=str(HERE / 'valley-hamlet.glb')); new = [o for o in bpy.data.objects if o not in before]
for o in new:
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)
root = [o for o in new if o.name.startswith('export:hamlet')][0]
near = scene.objects['Valley ground (near, 2 m)']; me = near.data; n = len(me.vertices)
co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(480, 500, 3)
gx0, gy0 = float(co[0, 0, 0]), float(co[0, 0, 1])  # x = -500 + 2i, y = 900 - 2j
def ground(x, y):
    fi = (x - gx0) / 2.0; fj = (gy0 - y) / 2.0; i = int(np.clip(np.floor(fi), 0, 498)); j = int(np.clip(np.floor(fj), 0, 478)); u, v = fi - i, fj - j
    z = co[:, :, 2]; return float((z[j, i] * (1 - u) + z[j, i + 1] * u) * (1 - v) + (z[j + 1, i] * (1 - u) + z[j + 1, i + 1] * u) * v)
yaw = math.radians(CAM_YAW); FWD = mathutils.Vector((math.sin(yaw), math.cos(yaw))); RIGHT = mathutils.Vector((math.cos(yaw), -math.sin(yaw))); EYE = mathutils.Vector(CAM)
def at_view(angle_deg, dist):  # a point at an angle right of the view axis and a distance from the camera
    a = yaw + math.radians(angle_deg); return EYE + mathutils.Vector((math.sin(a), math.cos(a))) * dist
HAMLET = at_view(14.0, 150.0)  # the right third
local = lambda dx, dy: HAMLET + RIGHT * dx + FWD * dy  # dx across the view, dy into it
# name in the export: (across, depth, turn away from facing the camera) - the chapel set back, the houses at different depths and angles
LAYOUT = {'Node_179': (9, 54, -0.95)}  # the chapel stays from the export; the houses and the barn are built below (houses.py)
_UNUSED = {'Node_260': (-21, -10, 0.8), 'Node_439': (18, 9, -0.65), 'Node_354': (-8, 32, 0.45), 'Node_535': (40, 38, -0.85),
          'Node_786': (-58, -18, 0.9)}  # spaced so each house has its own ground; fronts turned away from us  # ... and one small granary apart, out in the meadow
face = lambda p: math.atan2(-p.x, p.y) if False else math.atan2(-(p.x - EYE.x), (p.y - EYE.y))
plots = []
for c in list(root.children):
    if c.name not in LAYOUT:
        for o in [c] + list(c.children_recursive): bpy.data.objects.remove(o)
        continue
    dx, dy, turn = LAYOUT[c.name]; p = c.matrix_world.translation.xy.copy(); q = local(dx, dy)
    face0 = math.atan2(-p.x, p.y)  # the export faced each building to the valley's own camera at its origin
    rot = face(q) - face0 + turn
    c.matrix_world = mathutils.Matrix.Translation((q.x, q.y, 0)) @ mathutils.Matrix.Rotation(rot, 4, 'Z') @ mathutils.Matrix.Translation((-p.x, -p.y, 0)) @ c.matrix_world
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ mathutils.Vector(b) for o in [c] + list(c.children_recursive) if o.type == 'MESH' for b in o.bound_box]
    xs, ys = [v.x for v in pts], [v.y for v in pts]; cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2; hx, hy = (max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2
    gs = [ground(cx + a * hx * 0.8, cy + b * hy * 0.8) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1), (0, 0))]; top = min(gs) + 0.45 * (max(gs) - min(gs))  # set into the slope, not perched on a tall plinth
    c.matrix_world.translation.z += top + 0.05 - c.matrix_world.translation.z
    plots.append((cx, cy, max(hx, hy) + 2.5))
bpy.context.view_layer.update()
# South Tyrol farmhouses (houses.py): stone-and-plaster ground floor, dark larch boards above, wide eaves, a gable balcony, shutters
from houses import farmhouse, barn
BUILT = [('House A', (-21, -10, 0.55), dict(w=11.5, d=13.0, wall_tint=(1.0, 0.95, 0.86), shutter=(0.17, 0.26, 0.17), seed=1)),
         ('House B', (18, 9, -0.5), dict(w=10.5, d=12.0, wall_tint=(1.0, 0.9, 0.76), shutter=(0.42, 0.12, 0.1), seed=2)),
         ('House C', (-8, 32, 0.35), dict(w=12.0, d=14.0, wall_tint=(0.98, 0.97, 0.94), shutter=(0.2, 0.22, 0.3), seed=3)),
         ('House D', (40, 38, -0.7), dict(w=10.0, d=11.5, wall_tint=(1.0, 0.88, 0.82), shutter=(0.17, 0.26, 0.17), seed=4, balcony=False)),
         ('Barn', (-58, -18, 0.9), None), ('Barn 2', (30, 62, -0.4), None)]
built_roots = []
for name, (dx, dy, turn), kw in BUILT:
    q = local(dx, dy); r = farmhouse(name, col, **kw) if kw else barn(name, col, seed=hash(name) % 97)
    v = EYE - q; r.rotation_euler = (0, 0, math.atan2(v.x, -v.y) + turn); r.location = (q.x, q.y, 0); bpy.context.view_layer.update()
    hw = (kw or {}).get('w', 7.0) / 2 + 1; hd = (kw or {}).get('d', 8.0) / 2 + 1
    gs = [ground(*(r.matrix_world @ mathutils.Vector((a * hw, b * hd, 0))).xy) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1), (0, 0), (-1, 0), (1, 0), (0, -1), (0, 1))]
    r.location.z = min(gs) + 0.3 * (max(gs) - min(gs)); built_roots.append(r)  # the plinth reaches 5 m down: no corner floats on a slope; plots.append((q.x, q.y, max(hw, hd) + 1.5))
bpy.context.view_layer.update()
# each house its own colour: the plaster (the house's largest surface) tinted - whitewash, warm cream, pale ochre, faded rose
TINTS = {'Node_260': (1.0, 0.93, 0.80), 'Node_439': (1.0, 0.86, 0.68), 'Node_354': (0.98, 0.98, 0.96), 'Node_535': (1.0, 0.84, 0.80), 'Node_179': (0.97, 0.95, 0.90)}
for c in root.children:
    if c.name not in TINTS: continue
    area = {}
    for o in [c] + list(c.children_recursive):
        if o.type != 'MESH': continue
        for p in o.data.polygons:
            m = o.data.materials[p.material_index] if o.data.materials else None
            if m: area[m.name] = area.get(m.name, 0) + p.area * max(o.matrix_world.to_scale())
    if not area: continue
    wall = max(area, key=area.get); tint = TINTS[c.name]; new_m = bpy.data.materials[wall].copy(); new_m.name = wall + ' ' + c.name
    for bsdf in [nd for nd in new_m.node_tree.nodes if nd.bl_idname == 'ShaderNodeBsdfPrincipled']:
        inp = bsdf.inputs['Base Color']; mixn = new_m.node_tree.nodes.new('ShaderNodeMix'); mixn.data_type = 'RGBA'; mixn.blend_type = 'MULTIPLY'; mixn.inputs[0].default_value = 1.0; mixn.inputs[7].default_value = (*tint, 1)
        if inp.is_linked: new_m.node_tree.links.new(inp.links[0].from_socket, mixn.inputs[6])
        else: mixn.inputs[6].default_value = inp.default_value
        new_m.node_tree.links.new(mixn.outputs[2], inp)
    for o in [c] + list(c.children_recursive):
        if o.type == 'MESH':
            for i, m in enumerate(o.data.materials):
                if m and m.name == wall: o.data.materials[i] = new_m
# smoke from three chimneys: thin, slow, leaning a little with the evening air
smoke_m = bpy.data.materials.new('Chimney smoke'); smoke_m.use_nodes = True; snt = smoke_m.node_tree; snt.nodes.clear(); so = snt.nodes.new('ShaderNodeOutputMaterial'); pv = snt.nodes.new('ShaderNodeVolumePrincipled')
pv.inputs['Color'].default_value = (0.7, 0.72, 0.78, 1); pv.inputs['Anisotropy'].default_value = 0.4; snt.links.new(pv.outputs[0], so.inputs['Volume'])
tc = snt.nodes.new('ShaderNodeTexCoord'); nz_ = snt.nodes.new('ShaderNodeTexNoise'); nz_.inputs['Scale'].default_value = 1.3; nz_.inputs['Detail'].default_value = 1.5; snt.links.new(tc.outputs['Generated'], nz_.inputs['Vector'])
sep = snt.nodes.new('ShaderNodeSeparateXYZ'); snt.links.new(tc.outputs['Generated'], sep.inputs[0]); fall = snt.nodes.new('ShaderNodeMapRange'); fall.inputs['From Min'].default_value = 0.0; fall.inputs['From Max'].default_value = 1.0; fall.inputs['To Min'].default_value = 1.0; fall.inputs['To Max'].default_value = 0.0; snt.links.new(sep.outputs['Z'], fall.inputs['Value'])
rr_ = snt.nodes.new('ShaderNodeMapRange'); rr_.inputs['From Min'].default_value = 0.4; rr_.inputs['From Max'].default_value = 0.75; snt.links.new(nz_.outputs['Fac'], rr_.inputs['Value'])
mul_ = snt.nodes.new('ShaderNodeMath'); mul_.operation = 'MULTIPLY'; snt.links.new(rr_.outputs[0], mul_.inputs[0]); snt.links.new(fall.outputs[0], mul_.inputs[1]); mul2 = snt.nodes.new('ShaderNodeMath'); mul2.operation = 'MULTIPLY'; mul2.inputs[1].default_value = 0.14; snt.links.new(mul_.outputs[0], mul2.inputs[0]); snt.links.new(mul2.outputs[0], pv.inputs['Density'])
SMOKE = False  # (volume smoke speckles at this sample count; off until it can be done properly)
for r_ in ([r_ for r_ in built_roots if 'chimney_top' in r_][:3] if SMOKE else []):
    name = r_.name; top = r_.matrix_world @ mathutils.Vector(tuple(r_['chimney_top']))
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.5, radius2=4.5, depth=1.0, location=(0, 0, 0)); sm_o = bpy.context.active_object; sm_o.name = 'Smoke ' + name  # widening as it rises
    sm_o.data.transform(mathutils.Matrix.Translation((0, 0, 0.5))); sm_o.scale = (1.0, 1.0, 14.0); sm_o.location = top; sm_o.rotation_euler = (math.radians(-24), math.radians(16), 0); sm_o.data.materials.append(smoke_m)  # drifting with the evening air
    for cc in list(sm_o.users_collection): cc.objects.unlink(sm_o)
    col.objects.link(sm_o)

x, y = co[:, :, 0].ravel().astype(float), co[:, :, 1].ravel().astype(float)
def scale_attrs(factor, keys_pred):
    for key in [a.name for a in me.attributes if keys_pred(a.name)]:
        a = np.empty(n, np.float32); me.attributes[key].data.foreach_get('value', a); me.attributes[key].data.foreach_set('value', (a * factor).astype(np.float32))
keep = np.ones(n)
for cx, cy, r in plots: keep *= sm(r, r + 6, np.hypot(x - cx, y - cy))
scale_attrs(keep, lambda k: k.startswith('dens_') or k == 'forest')
# cottage-garden flowers just outside each house plot: pink at the doors, a lived-in touch
ring = np.zeros(n)
for cx, cy, r in plots: dd = np.hypot(x - cx, y - cy); ring = np.maximum(ring, sm(r, r + 1.5, dd) * (1 - sm(r + 5, r + 9, dd)))
if 'dens_fl_pink' in me.attributes:
    a = np.empty(n, np.float32); me.attributes['dens_fl_pink'].data.foreach_get('value', a); me.attributes['dens_fl_pink'].data.foreach_set('value', np.maximum(a, 0.7 * ring).astype(np.float32))
# the cluster's ground: no forest over it (it stands in its clearing), the trees are placed by hand below
clear = 1 - np.exp(-(((x - HAMLET.x) / 70) ** 2 + ((y - HAMLET.y) / 60) ** 2)); scale_attrs(clear, lambda k: k == 'forest')

# trees wrapping it: alder in front overlapping the houses, round its sides, spruce at its back
rg_ = np.random.default_rng(5)
def plant(src, p, s):
    o = bpy.data.objects[src].copy(); col.objects.link(o); o.location = (p.x, p.y, ground(p.x, p.y) - 0.1); o.scale = (s, s, s); o.rotation_euler = (0, 0, rg_.uniform(0, 6.28)); o.hide_render = False
def clear_of_houses(p, gap=2.0): return min(math.hypot(p.x - cx, p.y - cy) - r for cx, cy, r in plots) > gap
# the trees grow as they would round an old hamlet: irregular small groups at its edges and behind it (where the ground rises), a few lone
# trees, one or two that happen to stand between the houses - wrapped, not decorated
GROUPS = [(-44, 4, 5, 9), (-34, 40, 6, 11), (-6, 66, 7, 13), (30, 72, 6, 12), (60, 44, 5, 10), (54, 6, 3, 7), (-58, -6, 2, 6), (20, 24, 2, 4)]
for gx, gy, cnt, rad in GROUPS:
    for k in range(cnt):
        a_ = rg_.uniform(0, 6.283); r_ = rad * math.sqrt(rg_.uniform(0, 1)); p = local(gx + math.cos(a_) * r_, gy + math.sin(a_) * r_ * 0.8)
        if clear_of_houses(p): plant('PLANT Norway Spruce', p, rg_.uniform(0.45, 1.0) * (0.75 if gy < 20 else 1.0))
for dx, dy in ((-70, 22), (76, 60), (-18, 92), (44, -14)):  # lone trees
    p = local(dx + rg_.uniform(-4, 4), dy + rg_.uniform(-4, 4))
    if clear_of_houses(p): plant('PLANT Norway Spruce', p, rg_.uniform(0.6, 1.0))  # (the alder read pale and white against the low sun)
for k in range(14):  # the wood at its back, thickening up the slope
    p = local(rg_.uniform(-70, 75), rg_.uniform(78, 120))
    if clear_of_houses(p, 4): plant('PLANT Norway Spruce', p, rg_.uniform(0.8, 1.3))

# the path: narrow and worn, starting clearly at our feet (8 m out, where the ground first shows) and leading gently up to the houses
ctrl = [EYE + FWD * 8 + RIGHT * 0.8, EYE + FWD * 30 + RIGHT * 3.5, EYE + FWD * 65 + RIGHT * 11, HAMLET - FWD * 40 + RIGHT * 2, local(-1, -9)]
P = []
for k in range(len(ctrl) - 1):
    for t in np.linspace(0, 1, 30, endpoint=False):
        p0, p1, p2, p3 = ctrl[max(k - 1, 0)], ctrl[k], ctrl[k + 1], ctrl[min(k + 2, len(ctrl) - 1)]; t2, t3 = t * t, t * t * t
        P.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
P.append(ctrl[-1]); P = np.array([(v.x, v.y) for v in P])
pd, _ = polyline_distance(x, y, P)
nz = 0.5 + 0.3 * np.sin(x * 0.23 + y * 0.17) * np.sin(x * 0.11 - y * 0.29) + 0.2 * np.sin(x * 0.71 + 1.3) * np.sin(y * 0.63)  # slow wander along its length
worn = (1 - sm(0.22 + 0.18 * nz, 0.55 + 0.2 * nz, pd)) * (0.75 + 0.25 * np.sin(x * 1.7) * np.sin(y * 1.9))  # worn by feet: uneven width, patchy earth
scale_attrs(1 - worn, lambda k: k.startswith('dens_'))
# the grass is scattered as 4-6 m patches: their centres must stay well clear or they cover the path whole
scale_attrs(sm(1.9 + 1.4 * nz, 2.9 + 1.4 * nz, pd), lambda k: k in ('dens_tall', 'dens_basal')); scale_attrs(sm(3.2 + 1.4 * nz, 4.2 + 1.4 * nz, pd), lambda k: k == 'dens_mid'); scale_attrs(sm(2.3, 3.3, pd), lambda k: k.startswith('dens_fl_'))  # no flowers on the walked ground itself
# the path's verges: small grass tufts (1.4 m pieces cut from the approved tall grass) fill right up to its edges, so it reads as a footpath, not a lane
import bmesh
for _o in [o_ for o_ in bpy.data.objects if o_.name.startswith('PATCH grass edge')]: bpy.data.objects.remove(_o)
if True:
    src = bpy.data.objects['PATCH grass basal']; bm = bmesh.new(); bm.from_mesh(src.data); bmesh.ops.scale(bm, vec=(1, 1, 0.55), verts=bm.verts)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if any(abs(v.co.x) > 0.7 or abs(v.co.y) > 0.7 for v in f.verts)], context='FACES'); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    em = bpy.data.meshes.new('PATCH grass edge'); bm.to_mesh(em); bm.free()
    for m_ in src.data.materials: em.materials.append(m_)
    eo = bpy.data.objects.new('PATCH grass edge', em); bpy.data.collections['Library'].objects.link(eo); eo.location = (0, 0, -500)
edge = sm(0.8 + 0.3 * nz, 1.1 + 0.3 * nz, pd) * (1 - sm(2.4 + 1.6 * nz, 3.4 + 1.6 * nz, pd)) * (0.75 + 0.25 * nz)  # the mown strip either side: short turf, so the line reads from eye height (hay meadows are walked this way)
if 'dens_edge' in me.attributes: me.attributes.remove(me.attributes['dens_edge'])
me.attributes.new('dens_edge', 'FLOAT', 'POINT').data.foreach_set('value', edge.astype(np.float32))
for m_ in [m_ for m_ in near.modifiers if m_.name == 'Path verges']: near.modifiers.remove(m_)
src_ng = [m_.node_group for m_ in near.modifiers if m_.name == 'PATCH grass tall'][0]; ng = src_ng.copy(); ng.name = 'Scatter path verges'
for nd in ng.nodes:
    if nd.bl_idname == 'GeometryNodeInputNamedAttribute': nd.inputs['Name'].default_value = 'dens_edge'
    if nd.bl_idname == 'GeometryNodeObjectInfo': nd.inputs['Object'].default_value = bpy.data.objects['PATCH grass edge']
    if nd.bl_idname == 'GeometryNodeDistributePointsOnFaces': nd.inputs['Distance Min'].default_value = 0.32; nd.inputs['Density Max'].default_value = 5.5 / 1.96  # a full short sward on the verges, no bare ground between tufts
mod_ = near.modifiers.new('Path verges', 'NODES'); mod_.node_group = ng
a = np.empty(n, np.float32); me.attributes['streambed'].data.foreach_get('value', a); me.attributes['streambed'].data.foreach_set('value', np.maximum(a, worn * 0.55).astype(np.float32))
a = np.empty(n, np.float32); me.attributes['damp_soil'].data.foreach_get('value', a); me.attributes['damp_soil'].data.foreach_set('value', np.maximum(a, worn * 0.8).astype(np.float32))  # trodden earth, darker than gravel

# the pond: calm still water in the near left, the frame's resting place
PC = at_view(-24.0, 46.0); RX, RY = 19.0, 12.5
c_, s_ = math.cos(yaw), math.sin(yaw); u = ((x - PC.x) * c_ - (y - PC.y) * s_) / RX; v = ((x - PC.x) * s_ + (y - PC.y) * c_) / RY; rr = np.sqrt(u * u + v * v); th_ = np.arctan2(v, u); rr = rr / (1 + 0.16 * np.sin(3 * th_ + 1.1) + 0.09 * np.sin(5 * th_ + 2.3) + 0.05 * np.sin(9 * th_ + 0.4))  # bays and points, not an ellipse
lvl = min(ground(PC.x + dx, PC.y + dy) for dx, dy in ((-RX, 0), (RX, 0), (0, -RY), (0, RY), (0, 0))) - 0.12
z = co[:, :, 2].ravel().astype(float); zz = np.where(rr < 1.0, np.minimum(z, lvl - 0.8 * (1 - rr * rr) - 0.06), z)
zz = np.where((rr >= 1.0) & (rr < 1.35), np.maximum(np.minimum(z, lvl + 0.1 * sm(1.0, 1.35, rr) + 0.03), lvl + 0.025), zz)  # a very low bank: from eye height a higher one hides the water  # a low soft bank all round, so the water stays in
co2 = co.reshape(-1, 3).copy(); co2[:, 2] = zz; me.vertices.foreach_set('co', co2.astype(np.float32).ravel()); me.update()
scale_attrs(sm(1.05, 1.3, rr), lambda k: k in ('dens_tall', 'dens_basal', 'dens_mid', 'dens_hill'));  # the meadow grass comes to the water and leans over it
scale_attrs(sm(1.15, 1.9, rr), lambda k: k.startswith('dens_fl_'))
ea = np.empty(n, np.float32); me.attributes['dens_edge'].data.foreach_get('value', ea); me.attributes['dens_edge'].data.foreach_set('value', np.maximum(ea * sm(1.0, 1.3, rr), sm(1.15, 1.3, rr) * (1 - sm(1.6, 1.9, rr))).astype(np.float32))  # short turf to the water's edge: a clean shore
for k_, v_ in (('streambed', 1 - sm(0.6, 0.8, rr)), ('damp_soil', (1 - sm(1.0, 1.4, rr)) * sm(0.8, 1.0, rr))):
    a = np.empty(n, np.float32); me.attributes[k_].data.foreach_get('value', a); me.attributes[k_].data.foreach_set('value', np.maximum(a, v_).astype(np.float32))
# the meadow between us and the pond grazed shorter, so the water shows over it from eye height
from common import cam_rel
_d, _a, _ah = cam_rel(x, y); _ang = np.degrees(np.arctan2(x - CAM[0], y - CAM[1])) - CAM_YAW
corr = sm(-40, -33, _ang) * (1 - sm(-15, -9, _ang)) * sm(8, 14, _d) * (1 - sm(46 - RY, 46 - RY + 4, _d))
scale_attrs(1 - 0.75 * corr, lambda k: k.startswith('dens_fl_')); scale_attrs(1 - 0.85 * corr, lambda k: k in ('dens_tall', 'dens_mid'))
ea = np.empty(n, np.float32); me.attributes['dens_edge'].data.foreach_get('value', ea); me.attributes['dens_edge'].data.foreach_set('value', np.maximum(ea, 0.8 * corr).astype(np.float32))
bpy.ops.mesh.primitive_circle_add(vertices=96, radius=1, fill_type='NGON', location=(PC.x, PC.y, lvl)); pond = bpy.context.active_object; pond.name = 'Water - pond'
pond.scale = (RX * 1.7, RY * 1.7, 1); pond.rotation_euler = (0, 0, -yaw); pm = bpy.data.materials.new('Still pond'); pm.use_nodes = True; pb = pm.node_tree.nodes['Principled BSDF']; pb.inputs['Base Color'].default_value = (0.012, 0.03, 0.035, 1); pb.inputs['Roughness'].default_value = 0.015; pb.inputs['IOR'].default_value = 1.33
pond.data.materials.append(pm)  # a dark mirror: it carries the sky's glow and the trees beyond
for c in list(pond.users_collection): c.objects.unlink(pond)
scene.collection.objects.link(pond)
# sedge clumps at the water's edge, in groups, here and there (they show in the reflection)
import bmesh as _bm
for _o in [o_ for o_ in bpy.data.objects if o_.name.startswith('PATCH sedge')]: bpy.data.objects.remove(_o)
src = bpy.data.objects['PATCH grass tall']; b_ = _bm.new(); b_.from_mesh(src.data)
_bm.ops.delete(b_, geom=[f for f in b_.faces if any(abs(v_.co.x) > 0.55 or abs(v_.co.y) > 0.55 for v_ in f.verts)], context='FACES'); _bm.ops.delete(b_, geom=[v_ for v_ in b_.verts if not v_.link_faces], context='VERTS')
_bm.ops.scale(b_, vec=(1, 1, 2.8), verts=b_.verts); sm_ = bpy.data.meshes.new('PATCH sedge'); b_.to_mesh(sm_); b_.free()
for m_ in src.data.materials: sm_.materials.append(m_)
sedge = bpy.data.objects.new('PATCH sedge', sm_); bpy.data.collections['Library'].objects.link(sedge); sedge.location = (0, 0, -500)
for k in range(140):
    th = k / 140 * 6.2832; grp = 0.5 + 0.5 * math.sin(th * 4 + 0.7) * math.sin(th * 7 + 2.0)
    if grp < 0.55 or rg_.random() > 0.55: continue
    rf = (1 + 0.16 * math.sin(3 * th + 1.1) + 0.09 * math.sin(5 * th + 2.3) + 0.05 * math.sin(9 * th + 0.4)) * rg_.uniform(0.94, 1.04)
    uu, vv = math.cos(th) * rf * RX, math.sin(th) * rf * RY; px, py = PC.x + uu * c_ + vv * s_, PC.y - uu * s_ + vv * c_
    o = sedge.copy(); col.objects.link(o); o.location = (px, py, lvl - 0.05); o.rotation_euler = (0, 0, rg_.uniform(0, 6.28)); sc_ = rg_.uniform(0.8, 1.25); o.scale = (sc_, sc_, sc_); o.hide_render = False
print('HAMLET placed', len(plots), 'at', tuple(round(t, 1) for t in HAMLET), 'pond', tuple(round(t, 1) for t in PC), round(lvl, 2))
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'valley_composition_01.blend'))
scene.render.filepath = str(HERE / 'renders' / 'hamlet-01.png'); bpy.ops.render.render(write_still=True); print('HAMLET done')
