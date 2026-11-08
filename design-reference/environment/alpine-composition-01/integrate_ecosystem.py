"""First editable vegetation integration into the existing approved alpine scene.
Does not regenerate terrain, grass, stream, buildings, mountains, camera or light.
"""
import bpy,json,math,random,hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
from mathutils import noise
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parent
FILE=ROOT/'echelon_alpine_composition_01.blend'
AUD=ROOT.parent/'asset-auditions'
COLLECTION='06 Meadow ecosystem - first integration'
SEED=56071
bpy.ops.wm.open_mainfile(filepath=str(FILE))
scene=bpy.context.scene;camera=scene.camera

def protected_snapshot(exclude=set()):
    result={'camera':{'name':camera.name,'matrix':[list(v) for v in camera.matrix_world],'lens':camera.data.lens,'sensor_width':camera.data.sensor_width},'objects':{}}
    for ob in scene.objects:
        if ob in exclude:continue
        r={'type':ob.type,'matrix':[list(v) for v in ob.matrix_world]}
        if ob.type=='MESH':
            coords=np.empty(len(ob.data.vertices)*3,dtype=np.float32);ob.data.vertices.foreach_get('co',coords)
            r.update(vertices=len(ob.data.vertices),polygons=len(ob.data.polygons),coordinates_sha256=hashlib.sha256(coords.tobytes()).hexdigest(),materials=[m.name if m else None for m in ob.data.materials])
        if ob.type=='LIGHT':r.update(energy=ob.data.energy,color=list(ob.data.color))
        result['objects'][ob.name]=r
    return result
old=bpy.data.collections.get(COLLECTION)
if old:
    for ob in list(old.all_objects):bpy.data.objects.remove(ob,do_unlink=True)
    for col in list(old.children):bpy.data.collections.remove(col)
    bpy.data.collections.remove(old)
baseline_path=ROOT/'ecosystem_geometry_preservation.json'
baseline=protected_snapshot()
if baseline_path.exists():
    expected=json.loads(baseline_path.read_text());assert baseline==expected,'Protected landscape changed since this integration baseline.'
else:baseline_path.write_text(json.dumps(baseline,indent=2))
root=bpy.data.collections.new(COLLECTION);scene.collection.children.link(root)
sources=bpy.data.collections.new('Botanical source geometry - hidden originals');root.children.link(sources)
prototypes=bpy.data.collections.new('Normalized source plants - used by Geometry Nodes');root.children.link(prototypes)
blooms=bpy.data.collections.new('Editable flower placements - independent species controls');root.children.link(blooms)
trees=bpy.data.collections.new('Authored trees and saplings - individual placements');root.children.link(trees)
report={'seed':SEED,'source_files':[],'prototypes':{},'flowers':{},'trees':[],'notes':[]}

def append_selected(path,predicate):
    before=set(bpy.data.objects)
    with bpy.data.libraries.load(str(path),link=False) as (fr,to):to.objects=[n for n in fr.objects if predicate(n)]
    for ob in to.objects:
        if ob:
            for c in list(ob.users_collection):c.objects.unlink(ob)
            sources.objects.link(ob);ob.hide_render=False;ob.hide_set(False)
    bpy.context.view_layer.update()
    report['source_files'].append(str(path))
    return [o for o in to.objects if o]

def prototype(name,objects,kind='flower'):
    meshes=[o for o in objects if o.type=='MESH'];assert meshes,name
    points=[ob.matrix_world@v.co for ob in meshes for v in ob.data.vertices]
    lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
    if kind=='mature':
        # Preserve the source ground plane; identify the trunk near that plane.
        trunk=[p for ob in meshes if 'Bark' in ob.name for p in [ob.matrix_world@v.co for v in ob.data.vertices]]
        near=sorted(trunk or points,key=lambda p:abs(p.z))[:32]
        anchor=Vector((sum(p.x for p in near)/len(near),sum(p.y for p in near)/len(near),0))
    else:
        near=[p for p in points if p.z<lo.z+(.025 if kind=='flower' else .12)]
        anchor=Vector((sum(p.x for p in near)/len(near),sum(p.y for p in near)/len(near),lo.z))
    parts=[]
    for ob in meshes:
        me=ob.data.copy();me.transform(Matrix.Translation(-anchor)@ob.matrix_world)
        part=bpy.data.objects.new('Source '+name+' | '+ob.name,me);prototypes.objects.link(part);parts.append(part)
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:p.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1:bpy.ops.object.join()
    plant=parts[0];plant.name='SOURCE - '+name;plant.data.name='Reusable '+name+' geometry';plant.hide_render=True;plant.hide_set(True)
    plant['role']='Editable source; flower point emitters or individual tree instances reference this geometry.'
    plant.data.calc_loop_triangles()
    for ob in objects:ob.hide_render=True;ob.hide_set(True)
    report['prototypes'][name]={'height_m':hi.z-anchor.z,'full_bounds_dimensions_m':list(hi-lo),'triangles':len(plant.data.loop_triangles),'materials':[m.name if m else None for m in plant.data.materials],'root_anchor_in_reference':list(anchor)}
    return plant
flower_path=AUD/'botanical-lineup'/'botanical_lineup.blend'
refs=append_selected(flower_path,lambda n:any(n.startswith(p+' | ') for p in ['Marguerite','Dandelion','Red clover','Carthusian pink']))
plants={}
for name,prefix in [('Marguerite','Marguerite'),('Dandelion','Dandelion'),('Red Clover','Red clover'),('Carthusian Pink','Carthusian pink')]:
    plants[name]=prototype(name,[o for o in refs if o.name.startswith(prefix+' | ')])
conifer_report=json.loads((AUD/'mature-conifers'/'audition_report.json').read_text())
conifer_names={r['name']+' | '+mesh for r in conifer_report['specimens'] if r['name'] in ['Norway Spruce','Larch'] for mesh in r['source_meshes']}
conifers=append_selected(AUD/'mature-conifers'/'mature_conifer_audition.blend',lambda n:n in conifer_names)
plants['Norway Spruce']=prototype('Norway Spruce',[o for o in conifers if o.name.startswith('Norway Spruce | ')],'mature')
plants['Larch']=prototype('Larch',[o for o in conifers if o.name.startswith('Larch | ')],'mature')
assert report['prototypes']['Norway Spruce']['triangles']==10387
assert report['prototypes']['Larch']['triangles']==12201
others=append_selected(AUD/'ecosystem-candidates'/'ecosystem_candidate_audition.blend',lambda n:n.startswith(('Black Alder Large | ','fir_sapling_a | ','fir_sapling_b | ','fir_sapling_c | ')))
plants['Black Alder']=prototype('Black Alder',[o for o in others if o.name.startswith('Black Alder Large | ')],'tree')
for letter in ['a','b','c']:
    plants['Fir '+letter.upper()]=prototype('Fir '+letter.upper(),[o for o in others if o.name.startswith('fir_sapling_'+letter+' | ')],'tree')
bpy.context.view_layer.update()
ground=bpy.data.objects['Continuous meadow foothills and mountain range'];water=bpy.data.objects['Water inside carved channel - static graded surface']
assert ground.matrix_world==Matrix.Identity(4) and water.matrix_world==Matrix.Identity(4)
deps=bpy.context.evaluated_depsgraph_get();gb=BVHTree.FromObject(ground,deps);wb=BVHTree.FromObject(water,deps)

def surface(x,y):return gb.ray_cast(Vector((x,y,250)),Vector((0,0,-1)),500)

def dry(x,y,z,margin=.28):
    for dx,dy in [(0,0),(margin,0),(-margin,0),(0,margin),(0,-margin)]:
        p,n,idx,d=surface(x+dx,y+dy)
        wp,wn,wi,wd=wb.ray_cast(Vector((x+dx,y+dy,250)),Vector((0,0,-1)),500)
        if not p or (wp and wp.z>p.z-.10):return False
    return True

def smooth(t):
    t=max(0,min(1,t));return t*t*(3-2*t)

def nfield(x,y,scale,seed):return .5+.5*noise.noise(Vector((x*scale,y*scale,seed)),noise_basis='PERLIN_ORIGINAL')

def flower_emitter(name,items):
    me=bpy.data.meshes.new(name+' editable root points');me.from_pydata([r['root'] for r in items],[],[]);me.update()
    for key in ['plant_rotation','plant_scale']:
        attr=me.attributes.new(key,'FLOAT_VECTOR','POINT')
        for data,item in zip(attr.data,items):data.vector=item['rotation'] if key=='plant_rotation' else item['scale']
    ob=bpy.data.objects.new('Meadow blooms - '+name,me);blooms.objects.link(ob)
    ob['species']=name;ob['authored_root_count']=len(items);ob['editability']='Edit root vertices or adjust Coverage / Plant size in the Geometry Nodes modifier.'
    group=bpy.data.node_groups.new('Echelon flowers - '+name,'GeometryNodeTree')
    group.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry');group.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry')
    cov=group.interface.new_socket(name='Coverage',in_out='INPUT',socket_type='NodeSocketFloat');cov.default_value=1;cov.min_value=0;cov.max_value=1
    size=group.interface.new_socket(name='Plant size',in_out='INPUT',socket_type='NodeSocketFloat');size.default_value=1;size.min_value=.1;size.max_value=2
    nodes=group.nodes;links=group.links
    entry=nodes.new('NodeGroupInput');entry.location=(-600,120)
    points=nodes.new('GeometryNodeMeshToPoints');points.mode='VERTICES';points.location=(-350,180);points.inputs['Radius'].default_value=.015;links.new(entry.outputs['Geometry'],points.inputs['Mesh'])
    info=nodes.new('GeometryNodeObjectInfo');info.transform_space='ORIGINAL';info.inputs['Object'].default_value=plants[name];info.inputs['As Instance'].default_value=True;info.location=(-330,-120)
    rot=nodes.new('GeometryNodeInputNamedAttribute');rot.data_type='FLOAT_VECTOR';rot.inputs['Name'].default_value='plant_rotation';rot.location=(-350,-330)
    scale=nodes.new('GeometryNodeInputNamedAttribute');scale.data_type='FLOAT_VECTOR';scale.inputs['Name'].default_value='plant_scale';scale.location=(-350,-520)
    mult=nodes.new('ShaderNodeVectorMath');mult.operation='SCALE';mult.location=(-100,-360);links.new(scale.outputs['Attribute'],mult.inputs[0]);links.new(entry.outputs['Plant size'],mult.inputs['Scale'])
    rnd=nodes.new('FunctionNodeRandomValue');rnd.data_type='FLOAT';rnd.inputs['Seed'].default_value=SEED;sample=nodes.new('ShaderNodeMath');sample.operation='LESS_THAN';links.new(rnd.outputs['Value'],sample.inputs[0]);links.new(entry.outputs['Coverage'],sample.inputs[1]);rnd.location=(-340,410);sample.location=(-100,380)
    instance=nodes.new('GeometryNodeInstanceOnPoints');instance.location=(150,180);links.new(points.outputs['Points'],instance.inputs['Points']);links.new(info.outputs['Geometry'],instance.inputs['Instance']);links.new(rot.outputs['Attribute'],instance.inputs['Rotation']);links.new(mult.outputs['Vector'],instance.inputs['Scale']);links.new(sample.outputs[0],instance.inputs['Selection'])
    out=nodes.new('NodeGroupOutput');out.location=(420,180);links.new(instance.outputs['Instances'],out.inputs['Geometry'])
    mod=ob.modifiers.new('Editable '+name+' population','NODES');mod.node_group=group
    return ob

rng=random.Random(SEED);items={k:[] for k in ['Marguerite','Dandelion','Red Clover','Carthusian Pink']};occupied={};attempts=145000
x0,x1=-85,95;y0,y1=-5.4,190;area=(x1-x0)*(y1-y0)
for i in range(attempts):
    x=rng.uniform(x0,x1);y=rng.uniform(y0,y1);p,normal,face,dist=surface(x,y)
    if not p or normal.z<.88:continue
    q=world_to_camera_view(scene,camera,p)
    if q.z<=0 or not(-.025<q.x<1.025 and -.065<q.y<.505):continue
    broad=nfield(x,y,.095,4.7);fine=nfield(x,y,.34,11.3)
    habitat=.24+1.5*smooth((broad-.30)/.42)
    habitat*=.6+.4*fine
    density=(2.55*(1-smooth((y-7)/32))+.42*(1-smooth((y-38)/45))+.065*(1-smooth((y-65)/125)))*habitat
    if rng.random()>min(1,density*area/attempts):continue
    if not dry(x,y,p.z):continue
    if not dry(x,y,p.z,1.4) and rng.random()>.60:continue
    key=(math.floor(x/.17),math.floor(y/.17))
    if key in occupied:continue
    occupied[key]=True
    # All four species intermix; species preference shifts smoothly without monoculture patches.
    a=.47+.08*(nfield(x,y,.15,23)-.5);b=.24+.05*(nfield(x,y,.2,7)-.5);c=.055
    choose=rng.random()
    name='Marguerite' if choose<a else 'Dandelion' if choose<a+b else 'Red Clover' if choose<a+b+c else 'Carthusian Pink'
    scale=rng.uniform(.86,1.22)
    if name=='Dandelion':scale*=1.38
    if name=='Red Clover':scale*=.85
    # Modest slenderness and height changes preserve recognizable botanical forms.
    scales=(scale*rng.uniform(.88,1.02),scale*rng.uniform(.88,1.02),scale*rng.uniform(.98,1.10))
    align=Vector((0,0,1)).rotation_difference(normal).to_matrix().to_4x4()
    rotation=(align@Matrix.Rotation(rng.uniform(0,math.tau),4,'Z')).to_euler()
    rootpoint=Vector((x,y,p.z-.012))
    height=report['prototypes'][name]['height_m']*scales[2]
    head=rootpoint+Vector((0,0,height))
    hq=world_to_camera_view(scene,camera,head)
    if not(-.04<hq.x<1.04 and -.02<hq.y<.52):continue
    hit,nn,ff,dd=gb.ray_cast(camera.location,(head-camera.location).normalized(),(head-camera.location).length-.04)
    if hit is not None:continue
    items[name].append({'root':list(rootpoint),'rotation':list(rotation),'scale':list(scales),'screen_head':[hq.x,hq.y],'depth_m':q.z})
for name,population in items.items():
    flower_emitter(name,population)
    report['flowers'][name]={'count':len(population),'heads_in_bottom_35_percent':sum(r['screen_head'][1]<.35 for r in population),'near_y_below_15':sum(r['root'][1]<15 for r in population),'midground_y15_to65':sum(15<=r['root'][1]<65 for r in population),'farther_y65_plus':sum(r['root'][1]>=65 for r in population),'points':population}

def tree(name,x,y,size,angle,description):
    p,n,face,d=surface(x,y);assert p is not None and dry(x,y,p.z,.28),(name,x,y)
    source=plants[name];ob=bpy.data.objects.new(name+' - '+description,source.data);trees.objects.link(ob)
    ob.location=(x,y,p.z-(.06 if name in ['Norway Spruce','Larch'] else .08));ob.rotation_euler[2]=angle;ob.scale=(size,size,size)
    ob['species']=name;ob['placement_intent']=description
    q=world_to_camera_view(scene,camera,ob.location)
    report['trees'].append({'name':ob.name,'species':name,'root':list(ob.location),'scale':size,'screen_root':list(q),'intent':description})
# Current reviewed tree hierarchy: three mature conifers and two associated saplings.
tree('Larch',-61,125,.92,1.85,'left slope anchor')
tree('Norway Spruce',-109,222,.82,-1.4,'distant left foothill remnant')
tree('Norway Spruce',88,174,.78,2.8,'quiet right hillside')
for name,x,y,s,a in [('Fir A',-58,122,1,1.3),('Fir C',-69,139,.92,-.4)]:tree(name,x,y,s,a,'young growth associated with left anchor')
report['notes']=['Existing terrain, water, grass meshes, hamlet, camera and lights are preserved byte-for-byte for geometry and transforms.','Flower roots are ray-cast onto the actual saved terrain; actual water geometry is tested at the root and four surrounding points.','Bloom density uses broad connected ecological fields, a near-camera emphasis and gradual distance reduction; all species intermingle.','Dandelions use a modest 1.38 scale multiplier before individual variation to give stems a chance above the short meadow; no leaves or heads are remodeled.','Earleaf omitted in this first pass: its 10 cm stature would be mostly hidden in the existing canopy, and no short-grass opening has been created merely to force it in.','Tree layout refined to one left larch anchor, one smaller distant spruce, one quiet right spruce and two associated saplings; no alder or right larch planted in the reviewed layout.']
for im in bpy.data.images:
    if im.source=='FILE' and all(im.size) and not im.packed_file:im.pack()
assert protected_snapshot(set(root.all_objects))==baseline,'Protected geometry or composition changed.'
report['protected_geometry_unchanged']=True
scene.camera=camera
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':a.spaces.active.region_3d.view_perspective='CAMERA';a.spaces.active.shading.type='MATERIAL'
bpy.context.preferences.filepaths.save_version=1 if not (ROOT/'ecosystem_integration_report.json').exists() else 0
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
render_settings={'x':scene.render.resolution_x,'y':scene.render.resolution_y,'percentage':scene.render.resolution_percentage,'samples':scene.cycles.samples,'device':scene.cycles.device,'filepath':scene.render.filepath}
try:
    pref=bpy.context.preferences.addons['cycles'].preferences;pref.compute_device_type='OPTIX';pref.get_devices()
    for d in pref.devices:d.use=d.type!='CPU'
    scene.cycles.device='GPU'
except Exception:scene.cycles.device='CPU'
scene.cycles.samples=128;scene.cycles.use_denoising=True;scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100;scene.render.filepath=str(ROOT/'ecosystem_integration_preview.png')
bpy.ops.render.render(write_still=True)
scene.render.resolution_x=render_settings['x'];scene.render.resolution_y=render_settings['y'];scene.render.resolution_percentage=render_settings['percentage'];scene.cycles.samples=render_settings['samples'];scene.cycles.device=render_settings['device'];scene.render.filepath=render_settings['filepath']
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
(ROOT/'ecosystem_integration_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('INTEGRATION COMPLETE',json.dumps({'flowers':{n:{k:v for k,v in r.items() if k!='points'} for n,r in report['flowers'].items()},'trees':len(report['trees']),'protected_geometry_unchanged':True}),flush=True)
