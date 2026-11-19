"""Valley composition 01, step 3: the approved meadow's own grass patches scattered over the valley by rule (Geometry Nodes), in distance tiers."""
import bpy, math, numpy as np
from pathlib import Path
HERE = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'valley_composition_01.blend'))
scene = bpy.context.scene
with bpy.data.libraries.load(str(HERE / 'valley-assets.blend'), link=False) as (src, dst): dst.objects = [n for n in src.objects if n.startswith('PATCH') or n.startswith('PLANT')]
lib = bpy.data.collections.get('Library') or bpy.data.collections.new('Library')
if lib.name not in scene.collection.children: scene.collection.children.link(lib)
for o in dst.objects:
    if o.name not in lib.objects: lib.objects.link(o)
    o.location = (0, 0, -500)  # out of sight; used only as instances
lib.hide_render = True
import json
L = json.loads((HERE / 'valley-layout.json').read_text()); path = np.array(L['footpath']); pth = np.stack([path[:, 0], -path[:, 1]], 1)
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def polyd(px, py, P):
    best = np.full(px.shape, 1e9); a, b = P[:-1], P[1:]; Pt = np.stack([px, py], 1)[:, None, :]
    for k in range(0, len(a), 40):
        A = a[k:k + 40][None]; B = b[k:k + 40][None]; AB = B - A; t = np.clip(((Pt - A) * AB).sum(-1) / np.maximum((AB * AB).sum(-1), 1e-9), 0, 1); best = np.minimum(best, np.sqrt(((Pt - (A + AB * t[..., None])) ** 2).sum(-1)).min(1))
    return best
TIERS = [('PATCH grass tall', 0, 70, 3.2), ('PATCH grass basal', 0, 70, 1.6), ('PATCH grass mid', 55, 190, 3.2), ('PATCH grass hill', 170, 420, 3.2)]
near = scene.objects['Valley ground (near, 2 m)']; me = near.data; n = len(me.vertices)
co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3); x, y, h = co[:, 0].astype(float), co[:, 1].astype(float), co[:, 2].astype(float)
get = lambda k: (lambda a: (me.attributes[k].data.foreach_get('value', a), a)[1])(np.empty(n, np.float32))
open_ground = (1 - get('alpine_rock')) * (1 - get('streambed')) * (1 - get('alpine_snow')) * sm(0.05, 0.4, h)
d = np.hypot(x, y); ang = np.degrees(np.abs(np.arctan2(x, y))); view = (1 - sm(42, 50, ang)) * (y > -5)
lane = sm(1.2, 3.0, polyd(x, y, pth))
for name, a, b, k in TIERS:
    dens = open_ground * view * sm(a - 8, a + 8, d) * (1 - sm(b - 15, b + 15, d)) * (lane if 'tall' in name or 'basal' in name else 1)
    key = 'dens_' + name.split()[-1]
    if key in me.attributes: me.attributes.remove(me.attributes[key])
    at = me.attributes.new(key, 'FLOAT', 'POINT'); at.data.foreach_set('value', np.clip(dens, 0, 1).astype(np.float32))

def scatter_tree(name, patch, key, area, cover):
    ng = bpy.data.node_groups.get(name) or bpy.data.node_groups.new(name, 'GeometryNodeTree'); ng.nodes.clear()
    if not ng.interface.items_tree:
        ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry'); ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = ng.nodes; Lk = ng.links.new
    gi = N.new('NodeGroupInput'); go = N.new('NodeGroupOutput')
    dist = N.new('GeometryNodeDistributePointsOnFaces'); dist.distribute_method = 'POISSON'
    attr = N.new('GeometryNodeInputNamedAttribute'); attr.data_type = 'FLOAT'; attr.inputs['Name'].default_value = key
    dist.inputs['Distance Min'].default_value = math.sqrt(area) * 0.3; dist.inputs['Density Max'].default_value = cover / area
    Lk(gi.outputs[0], dist.inputs['Mesh']); Lk(attr.outputs[0] if 'Attribute' in attr.outputs else attr.outputs[0], dist.inputs['Density Factor'])
    info = N.new('GeometryNodeObjectInfo'); info.inputs['Object'].default_value = patch; info.inputs['As Instance'].default_value = True; info.transform_space = 'ORIGINAL'
    inst = N.new('GeometryNodeInstanceOnPoints'); Lk(dist.outputs['Points'], inst.inputs['Points']); Lk(info.outputs['Geometry'], inst.inputs['Instance'])
    rot = N.new('FunctionNodeRandomValue'); rot.data_type = 'FLOAT_VECTOR'; vin = [s for s in rot.inputs if s.type == 'VECTOR']; vin[0].default_value = (0, 0, 0); vin[1].default_value = (0, 0, 6.2832)
    e2r = N.new('FunctionNodeEulerToRotation'); Lk([s for s in rot.outputs if s.type == 'VECTOR'][0], e2r.inputs[0]); Lk(e2r.outputs[0], inst.inputs['Rotation'])
    sc = N.new('FunctionNodeRandomValue'); sc.data_type = 'FLOAT'; fin = [s for s in sc.inputs if s.type == 'VALUE']; fin[0].default_value = 0.85; fin[1].default_value = 1.15; Lk([s for s in sc.outputs if s.type == 'VALUE'][0], inst.inputs['Scale'])
    join = N.new('GeometryNodeJoinGeometry'); Lk(gi.outputs[0], join.inputs[0]); Lk(inst.outputs[0], join.inputs[0]); Lk(join.outputs[0], go.inputs[0])
    return ng
for m in list(near.modifiers):
    if m.type == 'NODES': near.modifiers.remove(m)
for name, a, b, k in TIERS:
    patch = bpy.data.objects[name]; area = (4 if 'tall' in name or 'basal' in name else 6 if 'mid' in name else 8) ** 2
    ng = scatter_tree('Scatter ' + name, patch, 'dens_' + name.split()[-1], area, k)
    mod = near.modifiers.new(name, 'NODES'); mod.node_group = ng
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'valley_composition_01.blend'))
scene.render.filepath = str(HERE / 'renders' / 'grass-01.png'); bpy.ops.render.render(write_still=True); print('GRASS done')
