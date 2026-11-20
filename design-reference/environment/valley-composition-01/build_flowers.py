"""Valley composition 01, step 5c: flower fields - the approved scene's four species (marguerite, dandelion, Carthusian pink, red clover)
in drifts the way a hay meadow flowers: broad white sweeps of marguerite, yellow dandelion pooled in the damper low ground, pink in small
clusters on the drier rises, clover scattered low through it all, and a thin scatter of every species between the drifts. Kept off the
water, the path, the rock and the house plots, and faded out where a flower would be smaller than a pixel."""
import bpy, numpy as np
from pathlib import Path
HERE = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'valley_composition_01.blend')); scene = bpy.context.scene
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def vnoise(x, y, seed):
    xi, yi = np.floor(x), np.floor(y); xf, yf = x - xi, y - yi; u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    h = lambda a, b: (np.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453) % 1.0
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v
def fbm(x, y, seed): return 0.55 * vnoise(x, y, seed) + 0.3 * vnoise(x * 2.2 + 3.1, y * 2.2, seed + 1) + 0.15 * vnoise(x * 4.7, y * 4.7 + 5.3, seed + 2)

if 'PLANT Celandine' not in bpy.data.objects:  # lesser celandine (CC0, asset-auditions/celandine-01)
    with bpy.data.libraries.load(str(HERE.parent / 'asset-auditions' / 'celandine-01' / 'celandine-01_source.blend'), link=False) as (s_, d_): d_.objects = ['celandine_01_c_LOD0']
    cel = d_.objects[0]; cel.name = 'PLANT Celandine'; bpy.data.collections['Library'].objects.link(cel); cel.location = (0, 0, -500); cel.rotation_euler = (0, 0, 0)
near = scene.objects['Valley ground (near, 2 m)']; me = near.data; n = len(me.vertices)
get = lambda k: (lambda a: (me.attributes[k].data.foreach_get('value', a), a)[1])(np.empty(n, np.float32))
co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3); x, y, h = co[:, 0].astype(float), co[:, 1].astype(float), co[:, 2].astype(float)
import sys; sys.path.insert(0, str(HERE)); from common import cam_rel
d, _ang, _ahead = cam_rel(x, y)
meadow = np.clip(get('dens_tall') + get('dens_mid') + get('dens_hill') * 0.6, 0, 1)  # the grass masks already keep off water, path, rock and houses
meadow *= sm(get('river_w') + 1.0, get('river_w') + 3.0, get('river_d'))
meadow *= 1 - sm(170, 260, d)
damp = get('damp_soil'); rise = sm(2.0, 9.0, h)
SPECIES = {
    'marguerite': (fbm(x / 60, y / 45, 11), 0.44, 0.7, 0.14, lambda: 0.7 + 0.6 * rise),  # white woven through, more on the drier ground
    'dandelion': (fbm(x / 30, y / 24, 23), 0.36, 0.66, 0.30, lambda: 1.0 + 0.5 * damp),  # buttercup yellow leads, richer where it is damp
    'pink': (fbm(x / 22, y / 18, 37), 0.62, 0.82, 0.02, lambda: 0.5 + 0.9 * rise),
    'celandine': (fbm(x / 24, y / 20, 51), 0.45, 0.7, 0.12, lambda: 0.7 + 0.8 * damp),  # low glossy yellow in the damper sward
}
for name, (field, lo, hi, scatter, bias) in SPECIES.items():
    wx, wy = x + 40 * (fbm(x / 120, y / 120, 81) - 0.5), y + 40 * (fbm(x / 120 + 7, y / 120, 82) - 0.5)  # warped, so no patch looks stamped
    rhythm = 0.18 + 0.82 * sm(0.3, 0.68, fbm(wx / 44, wy / 32, 71)) * (0.75 + 0.25 * fbm(x / 9, y / 9, 91))  # soft drifts that thin gradually into quieter green (no on/off patches)
    rhythm *= 1 + 0.5 * sm(6, 9, d) * (1 - sm(18, 30, d))  # a little more just in front of us
    v = (sm(lo, hi, field) + scatter) * meadow * (bias() if bias else 1.0) * rhythm
    key = 'dens_fl_' + name
    if key in me.attributes: me.attributes.remove(me.attributes[key])
    me.attributes.new(key, 'FLOAT', 'POINT').data.foreach_set('value', np.clip(v, 0, 1).astype(np.float32))
    print('FLOWERS', name, 'mean', round(float(np.clip(v, 0, 1).mean()), 3))

def scatter_tree(name, attr, plant, spacing, density, smin, smax):
    ng = bpy.data.node_groups.get(name) or bpy.data.node_groups.new(name, 'GeometryNodeTree'); ng.nodes.clear()
    if not ng.interface.items_tree:
        ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry'); ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = ng.nodes; Lk = ng.links.new; gi = N.new('NodeGroupInput'); go = N.new('NodeGroupOutput')
    dist = N.new('GeometryNodeDistributePointsOnFaces'); dist.distribute_method = 'POISSON'; dist.inputs['Distance Min'].default_value = spacing; dist.inputs['Density Max'].default_value = density
    at = N.new('GeometryNodeInputNamedAttribute'); at.data_type = 'FLOAT'; at.inputs['Name'].default_value = attr; Lk(gi.outputs[0], dist.inputs['Mesh']); Lk(at.outputs[0], dist.inputs['Density Factor'])
    info = N.new('GeometryNodeObjectInfo'); info.inputs['Object'].default_value = plant; info.inputs['As Instance'].default_value = True; info.transform_space = 'ORIGINAL'
    inst = N.new('GeometryNodeInstanceOnPoints'); Lk(dist.outputs['Points'], inst.inputs['Points']); Lk(info.outputs['Geometry'], inst.inputs['Instance'])
    rot = N.new('FunctionNodeRandomValue'); rot.data_type = 'FLOAT_VECTOR'; v = [s for s in rot.inputs if s.type == 'VECTOR']; v[0].default_value = (-0.12, -0.12, 0); v[1].default_value = (0.12, 0.12, 6.2832)
    e2r = N.new('FunctionNodeEulerToRotation'); Lk([s for s in rot.outputs if s.type == 'VECTOR'][0], e2r.inputs[0]); Lk(e2r.outputs[0], inst.inputs['Rotation'])
    sc = N.new('FunctionNodeRandomValue'); sc.data_type = 'FLOAT'; f = [s for s in sc.inputs if s.type == 'VALUE']; f[0].default_value = smin; f[1].default_value = smax; Lk([s for s in sc.outputs if s.type == 'VALUE'][0], inst.inputs['Scale'])
    join = N.new('GeometryNodeJoinGeometry'); Lk(gi.outputs[0], join.inputs[0]); Lk(inst.outputs[0], join.inputs[0]); Lk(join.outputs[0], go.inputs[0]); return ng

for m in [m for m in near.modifiers if m.name.startswith('Flowers')]: near.modifiers.remove(m)
for name, plant, spacing, density, smin, smax in (('marguerite', 'PLANT Marguerite', 0.1, 13.0, 1.0, 1.4), ('dandelion', 'PLANT Dandelion', 0.09, 20.0, 1.9, 2.8),
                                                  ('pink', 'PLANT Carthusian Pink', 0.12, 9.0, 0.8, 1.3), ('celandine', 'PLANT Celandine', 0.1, 14.0, 1.6, 2.3)):
    mod = near.modifiers.new('Flowers ' + name, 'NODES'); mod.node_group = scatter_tree('Scatter flowers ' + name, 'dens_fl_' + name, bpy.data.objects[plant], spacing, density, smin, smax)
# the dandelion stands in for buttercup: its yellow brightened and cleaned (it read mustard in the low light)
for slot in bpy.data.objects['PLANT Dandelion'].material_slots:
    m_ = slot.material
    if not m_ or not m_.use_nodes or m_.get('brightened'): continue
    for bsdf in [nd for nd in m_.node_tree.nodes if nd.bl_idname == 'ShaderNodeBsdfPrincipled']:
        inp = bsdf.inputs['Base Color']; hs = m_.node_tree.nodes.new('ShaderNodeHueSaturation'); hs.inputs['Saturation'].default_value = 1.35; hs.inputs['Value'].default_value = 1.35
        if inp.is_linked: src = inp.links[0].from_socket; m_.node_tree.links.new(src, hs.inputs['Color'])
        else: hs.inputs['Color'].default_value = inp.default_value
        m_.node_tree.links.new(hs.outputs['Color'], inp)
    m_['brightened'] = True
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'valley_composition_01.blend'))
scene.render.filepath = str(HERE / 'renders' / 'flowers-01.png'); bpy.ops.render.render(write_still=True); print('FLOWERS done')
