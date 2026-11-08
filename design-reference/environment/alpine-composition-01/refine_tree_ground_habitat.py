"""Local tree-ground habitat response. No landscape regeneration or new assets.
Raw landscape and botanical source meshes remain intact; removable modifiers
use saved attributes for shared soil/grass/flower transitions.
"""
import bpy, math, json, hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parent
FILE=ROOT/'echelon_alpine_composition_01.blend'
bpy.ops.wm.open_mainfile(filepath=str(FILE))
s=bpy.context.scene; camera=s.camera
GROUND='Continuous meadow foothills and mountain range'
WATER='Water inside carved channel - static graded surface'
GRASSES={'Foreground arching grass':18,'Low basal meadow foliage':18,'Midground meadow continuation':12,'Meadow to foothill transition':12}
def coords(o):
    a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
def digest(a):return hashlib.sha256(a.tobytes()).hexdigest()
def snapshot():
    return {'camera':{'name':camera.name,'matrix':[list(r) for r in camera.matrix_world],'lens':camera.data.lens},'meshes':{o.name:digest(coords(o)) for o in s.objects if o.type=='MESH'},'poses':{o.name:[list(r) for r in o.matrix_world] for o in s.objects},'lights':{o.name: {'matrix':[list(r) for r in o.matrix_world],'energy':o.data.energy} for o in s.objects if o.type=='LIGHT'}}
baseline=ROOT/'tree_ground_habitat_baseline.json'
if not baseline.exists():baseline.write_text(json.dumps(snapshot(),indent=2))
before=json.loads(baseline.read_text())
previous_relief=bpy.data.objects[GROUND].modifiers.get('Tree habitat - local root microrelief')
if previous_relief:previous_relief.show_viewport=False
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get();gb=BVHTree.FromObject(bpy.data.objects[GROUND],deps);wb=BVHTree.FromObject(bpy.data.objects[WATER],deps)
def seat(x,y):
    p,n,*_=gb.ray_cast(Vector((x,y,350)),Vector((0,0,-1)),700)
    assert p is not None
    wp,*_=wb.ray_cast(Vector((x,y,350)),Vector((0,0,-1)),700)
    assert wp is None or wp.z<p.z-.08,('submerged habitat',x,y)
    return p,n
# The clipped frame actor becomes a quieter near-bank tree, retaining its 6 m height.
fg=bpy.data.objects['Norway Spruce - foreground-left stream shelter']
p,n=seat(-16.3710594,18.2968540);fg.location=(p.x,p.y,p.z+.032)
fg['placement_intent']='Unclipped near-bank shelter; retains original 6 m stature, with one continuous local grass/soil/fern response.'
# Bring the isolated distant specimen into the existing slope family, at a different depth.
back=bpy.data.objects['Norway Spruce - distant left foothill remnant']
p,n=seat(-91,187);back.location=(p.x,p.y,p.z-.08)
back['placement_intent']='Receding member of left slope family, with overlapping canopy depth rather than a separate evenly spaced specimen.'
bpy.context.view_layer.update()
# Overlapping, warped habitat fields: compact root core + lopsided sheltered apron.
trees=bpy.data.collections['Authored trees and saplings - individual placements']
centers=[]
for o in trees.objects:
    if o.hide_render:continue
    if o==fg:radius=3.25
    elif o.get('species') in ('Larch','Norway Spruce') or o.name.startswith(('Larch','Norway Spruce')):radius=5.0 if o.name.startswith('Larch - left') else 3.8
    else:radius=.95
    centers.append((o.location.x,o.location.y,radius))
def smooth(a):
    a=np.clip(a,0,1);return a*a*(3-2*a)
FERN_PLACEMENTS=[(-16.8,17.0,1.20,.3),(-15.8,15.7,1.10,1.7),(-16.0,17.7,1.15,-.6),(-14.5,16.4,1.35,2.5),(-17.4,16.3,1.30,-1.3),(-16.8,15.6,1.12,.9),(-17.9,17.0,1.20,2.1)]
def fields(x,y):
    x=np.asarray(x);y=np.asarray(y)
    shelter=np.zeros_like(x,dtype=np.float32);core=shelter.copy()
    for i,(cx,cy,r) in enumerate(centers):
        dx=x-cx;dy=y-cy
        # An oblique lee-side extension and broad unequal lobes, never circular mulch rings.
        wx=dx+.27*r*np.sin(dy/r*1.8+i*.8)
        wy=dy+.18*r*np.sin(dx/r*2.2+i)
        lee=-.28 if abs(cx-fg.location.x)<.01 and abs(cy-fg.location.y)<.01 else .32
        rr=np.sqrt((wx/(r*1.10))**2+((wy-lee*r)/(r*1.35))**2)
        lobe=smooth((1.55-rr)/1.35)
        lobe*=.77+.14*np.sin(x*1.5+y*.7+i)+.09*np.sin(y*2.2-x*.9)
        shelter=1-(1-shelter)*(1-np.clip(lobe,0,1))
        rr0=np.sqrt((dx/(r*.31+.14))**2+(dy/(r*.25+.14))**2)
        core=np.maximum(core,smooth((1.35-rr0)/1.25))
    # Low existing ferns open the taller grass locally rather than disappearing in it.
    for i,(fx,fy,size,yaw) in enumerate(FERN_PLACEMENTS):
        dx=x-fx;dy=y-fy;rad=.90+.17*math.sin(i*1.8)
        rr=np.sqrt((dx/(rad*1.12))**2+(dy/rad)**2)
        fern_shelter=.70*smooth((1.40-rr)/1.15)
        shelter=1-(1-shelter)*(1-fern_shelter)
        core=np.maximum(core,.65*smooth((.62-rr)/.52))
    return np.clip(shelter,0,1),np.clip(core,0,1)
def attribute(mesh,name,values,domain='POINT',kind='FLOAT'):
    a=mesh.attributes.get(name)
    if a and (a.domain!=domain or a.data_type!=kind):mesh.attributes.remove(a);a=None
    if not a:a=mesh.attributes.new(name,kind,domain)
    a.data.foreach_set('value',np.asarray(values).ravel())
def offset_group(name,remove=False):
    g=bpy.data.node_groups.get(name)
    if g:bpy.data.node_groups.remove(g,do_unlink=True)
    g=bpy.data.node_groups.new(name,'GeometryNodeTree');g.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry');g.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry')
    a=g.nodes.new('NodeGroupInput');out=g.nodes.new('NodeGroupOutput');a.location=(-500,0);out.location=(380,0)
    pos=g.nodes.new('GeometryNodeSetPosition');pos.location=(50,0)
    attr=g.nodes.new('GeometryNodeInputNamedAttribute');attr.data_type='FLOAT';attr.inputs['Name'].default_value='tree_habitat_z';attr.location=(-500,-180)
    xyz=g.nodes.new('ShaderNodeCombineXYZ');xyz.location=(-230,-160);g.links.new(attr.outputs['Attribute'],xyz.inputs['Z']);g.links.new(xyz.outputs[0],pos.inputs['Offset']);g.links.new(a.outputs['Geometry'],pos.inputs['Geometry'])
    last=pos.outputs['Geometry']
    if remove:
        d=g.nodes.new('GeometryNodeDeleteGeometry');d.domain='FACE';d.mode='ALL';d.location=(220,0)
        sel=g.nodes.new('GeometryNodeInputNamedAttribute');sel.data_type='BOOLEAN';sel.inputs['Name'].default_value='tree_habitat_thin';sel.location=(-100,-350)
        g.links.new(last,d.inputs['Geometry']);g.links.new(sel.outputs['Attribute'],d.inputs['Selection']);last=d.outputs['Geometry']
    g.links.new(last,out.inputs['Geometry']);return g
soil=bpy.data.objects[GROUND];a=coords(soil);h,c=fields(a[:,0],a[:,1]);relief=.035*c+.012*h
# Protect the watercourse: no soil tint or root relief where water occupies the terrain.
wet=np.zeros(len(a),bool)
for idx in np.flatnonzero(h>.001):
    wp,*_=wb.ray_cast(Vector((float(a[idx,0]),float(a[idx,1]),350)),Vector((0,0,-1)),700)
    wet[idx]=wp is not None and wp.z>a[idx,2]-.10
h[wet]=0;c[wet]=0;relief[wet]=0
attribute(soil.data,'tree_habitat_soil',np.clip(.46*h+.37*c,0,.8))
attribute(soil.data,'tree_habitat_z',relief)
groundgroup=offset_group('Tree habitat - subtle root microrelief')
mod=soil.modifiers.get('Tree habitat - local root microrelief') or soil.modifiers.new('Tree habitat - local root microrelief','NODES');mod.node_group=groundgroup;mod.show_viewport=True;mod.show_render=True
# Reuse the actual scanned earth material. This field also governs the nearby vegetation.
t=bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks'];bs=t.nodes['Terrain surface']
old=t.nodes.get('Tree habitat - soil response')
if old:
    original=old.inputs[1].links[0].from_socket;t.links.new(original,bs.inputs['Base Color']);t.nodes.remove(old)
original=bs.inputs['Base Color'].links[0].from_socket
mask=t.nodes.get('Tree habitat - soil mask') or t.nodes.new('ShaderNodeAttribute');mask.name='Tree habitat - soil mask';mask.attribute_name='tree_habitat_soil';mask.location=(bs.location.x-700,bs.location.y-500)
mix=t.nodes.new('ShaderNodeMixRGB');mix.name='Tree habitat - soil response';mix.blend_type='MIX';mix.location=(bs.location.x-220,bs.location.y+120)
earth=t.nodes.get('Tree habitat - earthy litter tone') or t.nodes.new('ShaderNodeMixRGB');earth.name='Tree habitat - earthy litter tone';earth.blend_type='MULTIPLY';earth.inputs[0].default_value=.45;earth.inputs[2].default_value=(.42,.32,.20,1);earth.location=(bs.location.x-470,bs.location.y-360)
t.links.new(t.nodes['earth scanned color'].outputs['Color'],earth.inputs[1])
t.links.new(mask.outputs['Fac'],mix.inputs[0]);t.links.new(original,mix.inputs[1]);t.links.new(earth.outputs[0],mix.inputs[2]);t.links.new(mix.outputs[0],bs.inputs['Base Color'])
grassgroup=offset_group('Tree habitat - rooted grass height and thinning',True)
report={'grass':{},'trees':[],'ferns':[],'protected':{},'notes':[]}
for name,block in GRASSES.items():
    o=bpy.data.objects[name];a=coords(o);assert len(a)%block==0
    chunks=a.reshape((-1,block,3));roots=chunks[:,1,:];h,c=fields(roots[:,0],roots[:,1])
    # Continuous shape variation, shortened grass in shade, low living basal cover retained.
    factor=np.maximum(.12,1-.72*h-.28*c)
    if name=='Low basal meadow foliage':factor=1-.22*h-.15*c
    z=(chunks[:,:,2]-roots[:,None,2])*(factor[:,None]-1)+(.035*c+.012*h)[:,None]
    # Whole blades removed together, never random faces. Lush fringe -> modest open root core.
    seed=np.mod(np.sin(roots[:,0]*127.1+roots[:,1]*311.7)*43758.5453,1)
    probability=.18*h+.62*c
    if name=='Low basal meadow foliage':probability=.07*h+.28*c
    remove=seed<probability
    faces_per_leaf=2*(block//3-1)
    assert len(o.data.polygons)==len(chunks)*faces_per_leaf,(name,len(o.data.polygons),len(chunks),faces_per_leaf)
    attribute(o.data,'tree_habitat_z',z.astype(np.float32).ravel())
    attribute(o.data,'tree_habitat_thin',np.repeat(remove,faces_per_leaf),domain='FACE',kind='BOOLEAN')
    m=o.modifiers.get('Tree habitat - grass response') or o.modifiers.new('Tree habitat - grass response','NODES');m.node_group=grassgroup;m.show_viewport=True;m.show_render=True
    report['grass'][name]={'source_blades':len(chunks),'locally_affected_blades':int(np.count_nonzero(h>.001)),'removed_blades':int(remove.sum()),'minimum_height_factor':float(factor.min())}
    print('GRASS',name,report['grass'][name],flush=True)
# Flower source points and species are preserved; shorten grass instead of raising blooms.
# The immediate shelter apron thins blooms gradually, using a removable GN selection gate.
for o in s.objects:
    if not o.name.startswith('Meadow blooms - '):continue
    a=coords(o);h,c=fields(a[:,0],a[:,1]);attribute(o.data,'tree_habitat_z',.035*c+.012*h)
    for m in o.modifiers:
        if m.type!='NODES':continue
        g=m.node_group
        if g is None:continue
        inst=next((n for n in g.nodes if n.bl_idname=='GeometryNodeInstanceOnPoints'),None)
        if not inst:continue
        if not g.nodes.get('Tree habitat - flower core exclusion'):
            gate=g.nodes.new('FunctionNodeBooleanMath');gate.name='Tree habitat - flower core exclusion';gate.operation='AND'
            old=inst.inputs['Selection'].links[0].from_socket if inst.inputs['Selection'].is_linked else None
            if old:g.links.new(old,gate.inputs[0])
            else:gate.inputs[0].default_value=True
            attr=g.nodes.new('GeometryNodeInputNamedAttribute');attr.data_type='FLOAT';attr.inputs['Name'].default_value='tree_habitat_core'
            compare=g.nodes.new('ShaderNodeMath');compare.operation='LESS_THAN';compare.inputs[1].default_value=.64
            g.links.new(attr.outputs['Attribute'],compare.inputs[0]);g.links.new(compare.outputs[0],gate.inputs[1]);g.links.new(gate.outputs[0],inst.inputs['Selection'])
        seed=np.mod(np.sin(a[:,0]*91.71+a[:,1]*153.13)*41758.53,1)
        attribute(o.data,'tree_habitat_core',(seed<np.clip(.78*h+.75*c,0,.98)).astype(np.float32))
    # Small root relief follows without altering any source point coordinates.
    m=o.modifiers.get('Tree habitat - flower root following') or o.modifiers.new('Tree habitat - flower root following','NODES');m.node_group=groundgroup
    # Root following must precede source instancing.
    idx=list(o.modifiers).index(m);o.modifiers.move(idx,0)
# Existing seven ferns redistributed as irregular understory on one sheltered side.
ferncol=bpy.data.collections.get('Ferns under foreground alder - editable shared meshes') or bpy.data.collections.get('Ferns in sheltered tree habitat - editable shared meshes')
ferncol.name='Ferns in sheltered tree habitat - editable shared meshes'
positions=FERN_PLACEMENTS
for o,(x,y,size,yaw) in zip(sorted(ferncol.objects,key=lambda v:v.name),positions):
    p,n=seat(x,y);h,c=fields(np.array([x]),np.array([y]));o.location=(x,y,p.z+float(.035*c[0]+.012*h[0])-.015);o.scale=(size,)*3;o.rotation_euler=(Vector((0,0,1)).rotation_difference(n).to_matrix().to_4x4()).to_euler();o.rotation_euler.z+=yaw;o['habitat']='Uneven sheltered apron: short grass, scanned earth and overlapping existing ferns, returning softly to flower meadow.'
    report['ferns'].append({'name':o.name,'location':list(o.location),'scale':size})
# A few restrained root flares connect the visible trunk to its tiny root hummock.
col=bpy.data.collections.get('08 Tree-ground habitat controls')
if not col:col=bpy.data.collections.new('08 Tree-ground habitat controls');s.collection.children.link(col)
for o in list(col.objects):bpy.data.objects.remove(o,do_unlink=True)
mat=next(m for m in fg.data.materials if 'Bark' in m.name)
verts=[];faces=[]
for angle,length,width in [(.4,.60,.11),(2.0,.43,.10),(3.7,.75,.12),(5.0,.48,.09)]:
    axis=Vector((math.cos(angle),math.sin(angle),0));side=Vector((-axis.y,axis.x,0));root=fg.location.copy();root.z+=.05
    ps=[root+axis*.055-side*width,root+axis*.055+side*width,root+axis*.065+Vector((0,0,.16)),root+axis*length]
    p,n=seat(ps[3].x,ps[3].y);ps[3].z=p.z+.016
    k=len(verts);verts.extend([tuple(p) for p in ps]);faces.extend([(k,k+3,k+2),(k+2,k+3,k+1)])
mesh=bpy.data.meshes.new('Restrained trunk-to-ground root flare');mesh.from_pydata(verts,[],faces);mesh.materials.append(mat)
o=bpy.data.objects.new('Spruce - restrained root seating',mesh);col.objects.link(o)
# Geometry, camera, water, hamlet and all plant source meshes must remain byte-identical.
after=snapshot()
assert before['camera']==after['camera'];assert before['lights']==after['lights']
for name,hash_ in before['meshes'].items():assert after['meshes'][name]==hash_,('source geometry changed',name)
allowed={fg.name,back.name}|{r['name'] for r in report['ferns']}
for name,matrix in before['poses'].items():
    if name not in allowed:assert after['poses'][name]==matrix,('protected pose changed',name)
report['protected']={'all_existing_raw_meshes_unchanged':True,'camera_and_lights_unchanged':True,'water_mountains_hamlet_unchanged':True,'flower_source_points_unchanged':True,'existing_meshes_checked':len(before['meshes'])}
report['trees']=[{'name':o.name,'location':list(o.location),'scale':list(o.scale)} for o in trees.objects if not o.hide_render]
report['notes']=['Local soil tint uses the existing scanned meadow earth; no downloaded assets.','Grass height and whole-blade thinning use the same warped, overlapping canopy/root fields as the soil; original meshes retained beneath removable modifiers.','Ground microrelief maximum 4.7 cm at tree roots, zero on the watercourse; all raw terrain vertices unchanged.','Flower instances are locally thinned through the shelter apron; the original points, flower models and species remain intact.','Foreground spruce retains 6 m stature; moved fully inside frame. Isolated back spruce now belongs to the left slope group.','Seven existing fern objects reused; no additional fern or shrub scatter.']
(ROOT/'tree_ground_habitat_report.json').write_text(json.dumps(report,indent=2))
bpy.context.preferences.filepaths.save_version=0
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
saved=(s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.cycles.use_denoising)
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=128;s.cycles.use_denoising=True;s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100;s.render.filepath=str(ROOT/'tree_ground_habitat_preview.png')
bpy.ops.render.render(write_still=True)
s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.cycles.use_denoising=saved
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
print('TREE GROUND HABITAT RENDERED',json.dumps(report['protected']),flush=True)
