"""Valley composition 01, step 4: the approved scene's sun, and forest by rule - spruce with some larch in stands on the valley sides and
foothills, with ragged edges and clearings; the valley floor, the rock and the snow stay open."""
import bpy, math, numpy as np
from pathlib import Path
HERE = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'valley_composition_01.blend'))
scene = bpy.context.scene
sun = scene.objects['Sun']; sun.rotation_euler = (1.06, 0.0, -0.927); sun.data.energy = 3.25  # the approved afternoon sun
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def vnoise(x, y, seed=0):
    xi, yi = np.floor(x), np.floor(y); xf, yf = x - xi, y - yi; u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    h = lambda a, b: (np.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453) % 1.0
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v
def fbm(x, y, s=0): return 0.5 * vnoise(x, y, s) + 0.3 * vnoise(x * 2.1 + 5, y * 2.1, s) + 0.2 * vnoise(x * 4.3, y * 4.3 + 9, s)
for ob in [scene.objects['Valley ground (near, 2 m)'], scene.objects['Valley far land (polar)']]:
    me = ob.data; n = len(me.vertices)
    co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3); x, y, h = co[:, 0].astype(float), co[:, 1].astype(float), co[:, 2].astype(float)
    nr = np.empty(n * 3, np.float32); me.vertices.foreach_get('normal', nr); slope = 1 - np.clip(nr.reshape(-1, 3)[:, 2], 0, 1)
    get = lambda k: (lambda a: (me.attributes[k].data.foreach_get('value', a), a)[1])(np.empty(n, np.float32))
    rock, snow, bed = get('alpine_rock'), get('alpine_snow'), get('streambed')
    d = np.hypot(x, y); ang = np.degrees(np.abs(np.arctan2(x, y))); view = (1 - sm(46, 56, ang)) * (y > 0)
    stands = sm(0.42, 0.6, fbm(x / 160, y / 160, 7) + 0.25 * sm(0.05, 0.25, slope))  # stands follow the slopes: the steeper sides wooded, clearings between
    edge = sm(0.35, 0.65, fbm(x / 22, y / 22, 11))  # a ragged edge, single trees outside it
    treeline = 1 - sm(650, 900, h + 200 * (fbm(x / 400, y / 400, 2) - 0.5))
    floor = sm(6, 22, h)  # the valley floor stays meadow
    forest = stands * (0.55 + 0.45 * edge) * treeline * floor * (1 - rock) * (1 - snow) * (1 - bed) * (1 - sm(0.55, 0.8, slope)) * view * sm(90, 160, d) * (1 - sm(5000, 7000, d))
    if 'forest' in me.attributes: me.attributes.remove(me.attributes['forest'])
    me.attributes.new('forest', 'FLOAT', 'POINT').data.foreach_set('value', forest.astype(np.float32))
    th = np.maximum(get('tree_habitat_soil'), sm(0.3, 0.7, forest) * 0.8); me.attributes['tree_habitat_soil'].data.foreach_set('value', th.astype(np.float32))  # dark needle floor under the stands
    print('FOREST', ob.name, 'forest cover', round(float(forest.mean()), 3))

def tree_scatter(name, plant, spacing, density, smin, smax, seed):
    ng = bpy.data.node_groups.get(name) or bpy.data.node_groups.new(name, 'GeometryNodeTree'); ng.nodes.clear()
    if not ng.interface.items_tree:
        ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry'); ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = ng.nodes; Lk = ng.links.new; gi = N.new('NodeGroupInput'); go = N.new('NodeGroupOutput')
    dist = N.new('GeometryNodeDistributePointsOnFaces'); dist.distribute_method = 'POISSON'; dist.inputs['Distance Min'].default_value = spacing; dist.inputs['Density Max'].default_value = density; dist.inputs['Seed'].default_value = seed
    attr = N.new('GeometryNodeInputNamedAttribute'); attr.data_type = 'FLOAT'; attr.inputs['Name'].default_value = 'forest'
    Lk(gi.outputs[0], dist.inputs['Mesh']); Lk(attr.outputs[0], dist.inputs['Density Factor'])
    info = N.new('GeometryNodeObjectInfo'); info.inputs['Object'].default_value = plant; info.inputs['As Instance'].default_value = True; info.transform_space = 'ORIGINAL'
    inst = N.new('GeometryNodeInstanceOnPoints'); Lk(dist.outputs['Points'], inst.inputs['Points']); Lk(info.outputs['Geometry'], inst.inputs['Instance'])
    rot = N.new('FunctionNodeRandomValue'); rot.data_type = 'FLOAT_VECTOR'; v = [s for s in rot.inputs if s.type == 'VECTOR']; v[0].default_value = (-0.04, -0.04, 0); v[1].default_value = (0.04, 0.04, 6.2832)
    e2r = N.new('FunctionNodeEulerToRotation'); Lk([s for s in rot.outputs if s.type == 'VECTOR'][0], e2r.inputs[0]); Lk(e2r.outputs[0], inst.inputs['Rotation'])
    sc = N.new('FunctionNodeRandomValue'); sc.data_type = 'FLOAT'; f = [s for s in sc.inputs if s.type == 'VALUE']; f[0].default_value = smin; f[1].default_value = smax; Lk([s for s in sc.outputs if s.type == 'VALUE'][0], inst.inputs['Scale'])
    join = N.new('GeometryNodeJoinGeometry'); Lk(gi.outputs[0], join.inputs[0]); Lk(inst.outputs[0], join.inputs[0]); Lk(join.outputs[0], go.inputs[0]); return ng
spruce, larch = bpy.data.objects['PLANT Norway Spruce'], bpy.data.objects['PLANT Larch']
for ob in [scene.objects['Valley ground (near, 2 m)'], scene.objects['Valley far land (polar)']]:
    for m in [m for m in ob.modifiers if m.name.startswith('Forest')]: ob.modifiers.remove(m)
    big = 'far' in ob.name
    for nm, plant, sp, dn, a, b, sd in (('Forest spruce', spruce, 5.0, 1 / 28, 0.55, 1.25, 3), ('Forest larch', larch, 7.0, 1 / 160, 0.5, 1.05, 9)):
        ng = tree_scatter(nm + (' far' if big else ' near'), plant, sp * (1.6 if big else 1), dn / (2.2 if big else 1), a, b, sd)
        mod = ob.modifiers.new(nm, 'NODES'); mod.node_group = ng
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'valley_composition_01.blend'))
scene.render.filepath = str(HERE / 'renders' / 'forest-01.png'); bpy.ops.render.render(write_still=True); print('FOREST done')
