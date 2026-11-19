"""Valley composition 01, step 5b: the river dressed like a real glacial river (ref: the Lonza in the Loetschental) - milky turquoise water
streaked with white water, cobble banks of the approved scene's limestone, boulders, alder scrub and the odd spruce on the banks. Also gives
the range its texture scale back (its world-scale materials were made for a range 12 times smaller; at this size they banded into lines)."""
import bpy, math, numpy as np
from pathlib import Path
HERE = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'valley_composition_01.blend')); scene = bpy.context.scene
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

# 1. the range's materials sample world space 12 times finer than they were made for: scale their coordinates back
rng = scene.objects['RANGE approved']
def rescale_tree(nt, k, seen):
    if nt.name in seen: return
    seen.add(nt.name)
    for nd in list(nt.nodes):
        if nd.bl_idname == 'ShaderNodeNewGeometry':
            for link in [l for l in nt.links if l.from_node == nd and l.from_socket.name == 'Position']:
                to = link.to_socket; vm = nt.nodes.new('ShaderNodeVectorMath'); vm.operation = 'SCALE'; vm.inputs['Scale'].default_value = k
                nt.links.remove(link); nt.links.new(nd.outputs['Position'], vm.inputs[0]); nt.links.new(vm.outputs[0], to)
        if nd.bl_idname == 'ShaderNodeGroup' and nd.node_tree:
            nd.node_tree = nd.node_tree.copy(); rescale_tree(nd.node_tree, k, seen)
for slot in rng.material_slots:
    if slot.material and not slot.material.name.endswith(' (range scale)'):
        m = slot.material.copy(); m.name = slot.material.name + ' (range scale)'; rescale_tree(m.node_tree, 1 / 12.0, set()); slot.material = m

# 2. the water: milky glacial turquoise, streaked white where it runs fast, roughened by its own flow
mat = bpy.data.materials.get('Glacial river') or bpy.data.materials.new('Glacial river'); mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear(); N = nt.nodes; L = nt.links.new
out = N.new('ShaderNodeOutputMaterial'); bs = N.new('ShaderNodeBsdfPrincipled'); L(bs.outputs[0], out.inputs[0])
uv = N.new('ShaderNodeUVMap'); uv.uv_map = 'flow'
mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (6.0, 1.6, 1.0); L(uv.outputs[0], mp.inputs[0])
nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.0; nz.inputs['Detail'].default_value = 8.0; nz.inputs['Roughness'].default_value = 0.62; L(mp.outputs[0], nz.inputs['Vector'])
mp2 = N.new('ShaderNodeMapping'); mp2.inputs['Scale'].default_value = (22.0, 3.0, 1.0); L(uv.outputs[0], mp2.inputs[0])
nz2 = N.new('ShaderNodeTexNoise'); nz2.inputs['Scale'].default_value = 4.0; nz2.inputs['Detail'].default_value = 6.0; L(mp2.outputs[0], nz2.inputs['Vector'])
mix = N.new('ShaderNodeMath'); mix.operation = 'MULTIPLY'; L(nz.outputs['Fac'], mix.inputs[0]); L(nz2.outputs['Fac'], mix.inputs[1])
foam = N.new('ShaderNodeValToRGB'); foam.color_ramp.elements[0].position = 0.24; foam.color_ramp.elements[1].position = 0.42; L(mix.outputs[0], foam.inputs[0])
col = N.new('ShaderNodeMix'); col.data_type = 'RGBA'; col.inputs[6].default_value = (0.36, 0.6, 0.6, 1); col.inputs[7].default_value = (0.86, 0.92, 0.92, 1)
L(foam.outputs[0], col.inputs[0]); L(col.outputs[2], bs.inputs['Base Color'])
rough = N.new('ShaderNodeMapRange'); rough.inputs['To Min'].default_value = 0.08; rough.inputs['To Max'].default_value = 0.55; L(foam.outputs[0], rough.inputs['Value']); L(rough.outputs[0], bs.inputs['Roughness'])
bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.55; bump.inputs['Distance'].default_value = 0.12; L(nz2.outputs['Fac'], bump.inputs['Height']); L(bump.outputs[0], bs.inputs['Normal'])
try:
    bs.inputs['Subsurface Weight'].default_value = 0.15; bs.inputs['Subsurface Radius'].default_value = (0.3, 0.6, 0.6)
except Exception: pass
riv = scene.objects['Water - river']; riv.data.materials.clear(); riv.data.materials.append(mat)

# 3. the banks: cobbles and boulders of the approved scene's limestone, alder scrub and a few spruce
for o in [o for o in bpy.data.objects if o.name.startswith('STONE ')]: bpy.data.objects.remove(o)
with bpy.data.libraries.load(str(HERE / 'valley-stones.blend'), link=False) as (s, d): d.objects = [n for n in s.objects if 'habitat limestone' in n]
stones = bpy.data.collections.get('Stones') or bpy.data.collections.new('Stones')
for o in d.objects: stones.objects.link(o); o.location = (0, 0, 0)
lib = bpy.data.collections['Library']
if stones.name not in [c.name for c in lib.children]: lib.children.link(stones)
near = scene.objects['Valley ground (near, 2 m)']; me = near.data; n = len(me.vertices)
get = lambda k: (lambda a: (me.attributes[k].data.foreach_get('value', a), a)[1])(np.empty(n, np.float32))
d_, w_ = get('river_d'), get('river_w'); co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
nz_ = 0.5 + 0.3 * np.sin(co[:, 0] / 17.0 + 1.7) * np.sin(co[:, 1] / 13.0) + 0.2 * np.sin(co[:, 0] / 5.3 + co[:, 1] / 7.1)
view = (co[:, 1] > 0) * (1 - sm(46, 56, np.degrees(np.abs(np.arctan2(co[:, 0], co[:, 1]))))) * sm(0.1, 0.35, get('orig_z'))  # dry ground only: nothing of the bank stands in the lake
cob = (sm(w_ * 0.8, w_ * 0.95, d_) * (1 - sm(w_ + 1.5 + 2.5 * nz_, w_ + 3.5 + 3.0 * nz_, d_))) * view * (d_ < 60)
bush = sm(w_ + 1.5, w_ + 3.0, d_) * (1 - sm(w_ + 7, w_ + 14, d_)) * sm(0.5, 0.7, nz_) * view
for k_, v_ in (('cobble', cob), ('bank_scrub', bush)):
    if k_ in me.attributes: me.attributes.remove(me.attributes[k_])
    me.attributes.new(k_, 'FLOAT', 'POINT').data.foreach_set('value', v_.astype(np.float32))

def scatter(name, attr, spacing, density, source, smin, smax, collection=False, tilt=0.0, sink=0.0):
    ng = bpy.data.node_groups.get(name) or bpy.data.node_groups.new(name, 'GeometryNodeTree'); ng.nodes.clear()
    if not ng.interface.items_tree:
        ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry'); ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = ng.nodes; Lk = ng.links.new; gi = N.new('NodeGroupInput'); go = N.new('NodeGroupOutput')
    dist = N.new('GeometryNodeDistributePointsOnFaces'); dist.distribute_method = 'POISSON'; dist.inputs['Distance Min'].default_value = spacing; dist.inputs['Density Max'].default_value = density
    at = N.new('GeometryNodeInputNamedAttribute'); at.data_type = 'FLOAT'; at.inputs['Name'].default_value = attr; Lk(gi.outputs[0], dist.inputs['Mesh']); Lk(at.outputs[0], dist.inputs['Density Factor'])
    if collection:
        ci = N.new('GeometryNodeCollectionInfo'); ci.inputs['Collection'].default_value = source; ci.inputs['Separate Children'].default_value = True; ci.inputs['Reset Children'].default_value = True; ci.transform_space = 'ORIGINAL'; src_out = ci.outputs[0]
    else:
        ci = N.new('GeometryNodeObjectInfo'); ci.inputs['Object'].default_value = source; ci.inputs['As Instance'].default_value = True; ci.transform_space = 'ORIGINAL'; src_out = ci.outputs['Geometry']
    inst = N.new('GeometryNodeInstanceOnPoints'); Lk(dist.outputs['Points'], inst.inputs['Points']); Lk(src_out, inst.inputs['Instance'])
    if collection:
        inst.inputs['Pick Instance'].default_value = True; ri = N.new('FunctionNodeRandomValue'); ri.data_type = 'INT'; ii = [s for s in ri.inputs if s.type == 'INT']; ii[0].default_value = 0; ii[1].default_value = 3
        Lk([s for s in ri.outputs if s.type == 'INT'][0], inst.inputs['Instance Index'])
    rot = N.new('FunctionNodeRandomValue'); rot.data_type = 'FLOAT_VECTOR'; v = [s for s in rot.inputs if s.type == 'VECTOR']; v[0].default_value = (-tilt, -tilt, 0); v[1].default_value = (tilt, tilt, 6.2832)
    e2r = N.new('FunctionNodeEulerToRotation'); Lk([s for s in rot.outputs if s.type == 'VECTOR'][0], e2r.inputs[0]); Lk(e2r.outputs[0], inst.inputs['Rotation'])
    sc = N.new('FunctionNodeRandomValue'); sc.data_type = 'FLOAT'; f = [s for s in sc.inputs if s.type == 'VALUE']; f[0].default_value = smin; f[1].default_value = smax; Lk([s for s in sc.outputs if s.type == 'VALUE'][0], inst.inputs['Scale'])
    tr = N.new('GeometryNodeTranslateInstances'); tr.inputs['Translation'].default_value = (0, 0, -sink); Lk(inst.outputs[0], tr.inputs[0])
    join = N.new('GeometryNodeJoinGeometry'); Lk(gi.outputs[0], join.inputs[0]); Lk(tr.outputs[0], join.inputs[0]); Lk(join.outputs[0], go.inputs[0]); return ng

for m in [m for m in near.modifiers if m.name.startswith('Bank')]: near.modifiers.remove(m)
# (cobbles and boulders on the banks were tried and taken out until there are good rock models)
for nm, args in (
                 ('Bank scrub', dict(attr='bank_scrub', spacing=2.5, density=0.05, source=bpy.data.objects['PLANT Black Alder'], smin=0.11, smax=0.24, tilt=0.12)),
                 ('Bank spruce', dict(attr='bank_scrub', spacing=9.0, density=0.006, source=bpy.data.objects['PLANT Norway Spruce'], smin=0.45, smax=0.9, tilt=0.03))):
    mod = near.modifiers.new(nm, 'NODES'); mod.node_group = scatter('Scatter ' + nm, **args)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'valley_composition_01.blend'))
scene.render.filepath = str(HERE / 'renders' / 'river-dress-01.png'); bpy.ops.render.render(write_still=True); print('DRESS done')
