"""Stronger static hero-camera structure/material pass, canonical scene in place."""
import bpy,numpy as np,json,sys,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parent;sys.path.insert(0,str(ROOT))
from habitat_structure_fields import HabitatStructure,masses,noise2,smooth
from stream_network import StreamNetwork
FILE=ROOT/'echelon_alpine_composition_01.blend';bpy.ops.wm.open_mainfile(filepath=str(FILE));s=bpy.context.scene;camera=s.camera
G='Continuous meadow foothills and mountain range';W='Water inside carved channel - static graded surface'
GRASSES={'Foreground arching grass':18,'Low basal meadow foliage':18,'Midground meadow continuation':12,'Meadow to foothill transition':12}
def coords(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
def attr(o,name,values,domain='POINT',kind='FLOAT'):
 at=o.data.attributes.get(name)
 if at is None:at=o.data.attributes.new(name,kind,domain)
 at.data.foreach_set('value',np.asarray(values).ravel())
def hash_(a):return hashlib.sha256(a.tobytes()).hexdigest()
archive=ROOT/'habitat_structure_source.npz';metadata=ROOT/'habitat_structure_source.json'
if not archive.exists():
 data={};meta={'objects':{},'meshes':{},'camera':{'matrix':[list(v) for v in camera.matrix_world],'lens':camera.data.lens},'lighting':{},'color':{'look':s.view_settings.look,'exposure':s.view_settings.exposure}}
 for o in s.objects:
  meta['objects'][o.name]={'matrix':[list(v) for v in o.matrix_world],'hidden':o.hide_get(),'render_hidden':o.hide_render}
  if o.type=='LIGHT':meta['lighting'][o.name]={'energy':o.data.energy,'color':list(o.data.color),'angle':o.data.angle}
 for i,name in enumerate([G,W]+list(GRASSES)+[o.name for o in s.objects if o.name.startswith('Meadow blooms - ')]):
  o=bpy.data.objects[name];a=coords(o);key='m'+str(i);data[key]=a;row={'key':key,'hash':hash_(a),'attributes':{}}
  for at in o.data.attributes:
   if at.name in ['streambed','damp_soil','meadow_vigor','alpine_rock','alpine_snow','valley_sward','tree_habitat_thin','tree_habitat_z','tree_habitat_core']:
    v=np.empty(len(at.data),np.bool_ if at.data_type=='BOOLEAN' else np.float32);at.data.foreach_get('value',v);ak=key+'_'+at.name;data[ak]=v;row['attributes'][at.name]={'key':ak,'domain':at.domain,'kind':at.data_type}
  if name in GRASSES:
   v=np.empty(len(o.data.polygons),np.int32);o.data.polygons.foreach_get('material_index',v);data[key+'_mats']=v
  meta['meshes'][name]=row
 bpy.context.view_layer.update();bv=BVHTree.FromObject(bpy.data.objects[G],bpy.context.evaluated_depsgraph_get());network=StreamNetwork()
 for k,(stream,ymin,ymax) in enumerate([(network.main,-14,100),(network.tributary,48,213)]):
  rows=[]
  for y in np.arange(ymin,ymax+.1,.5):
   cx=stream.center(y);f=stream.factor(y);lev=stream.level(y);xs=np.linspace(cx-13*f,cx+13*f,261);zs=[]
   for x in xs:
    p,n,*_=bv.ray_cast(Vector((float(x),float(y),350)),Vector((0,0,-1)),750);zs.append(p.z if p else 1e4)
   zs=np.array(zs);center=np.argmin(zs);left=right=int(center)
   while left>0 and zs[left-1]<lev:left-=1
   while right<len(xs)-1 and zs[right+1]<lev:right+=1
   if right==left:continue
   l=np.interp(lev,[zs[left],zs[max(0,left-1)]],[xs[left],xs[max(0,left-1)]])
   r=np.interp(lev,[zs[right],zs[min(len(xs)-1,right+1)]],[xs[right],xs[min(len(xs)-1,right+1)]])
   rows.append([y,(l+r)/2,l,r,lev,f])
  data['sections'+str(k)]=np.array(rows)
 np.savez_compressed(archive,**data);metadata.write_text(json.dumps(meta,indent=2));print('HABITAT STRUCTURE SOURCE SAVED',flush=True)
meta=json.loads(metadata.read_text());src=np.load(archive);fields=HabitatStructure([src['sections0'],src['sections1']])
for name,rec in meta['meshes'].items():
 o=bpy.data.objects[name];o.data.vertices.foreach_set('co',src[rec['key']].ravel());o.data.update()
 for at,info in rec['attributes'].items():o.data.attributes[at].data.foreach_set('value',src[info['key']])
 if name in GRASSES:o.data.polygons.foreach_set('material_index',src[rec['key']+'_mats'])
def original(name):return src[meta['meshes'][name]['key']]
def original_attr(name,at):return src[meta['meshes'][name]['attributes'][at]['key']].copy()
g=bpy.data.objects[G];bpy.context.view_layer.update();source_ground_bvh=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get());a=original(G);new=a.copy();new[:,2]+=fields.offset(a);g.data.vertices.foreach_set('co',new.ravel());g.data.update()
ledges,bars,d,lev=fields.bank_patches(a[:,0],a[:,1]);mass=masses(a[:,0],a[:,1]);meadow=smooth((a[:,1]+3)/9)*(1-smooth((a[:,1]-155)/45))
attr(g,'streambed',np.maximum(original_attr(G,'streambed'),np.maximum(bars*.88,ledges*.72)))
attr(g,'damp_soil',np.clip(original_attr(G,'damp_soil')*(1-.35*bars)+.25*ledges,0,1))
attr(g,'meadow_vigor',np.clip(original_attr(G,'meadow_vigor')+(mass-.5)*.40*meadow,0,1));attr(g,'valley_sward',np.clip(original_attr(G,'valley_sward')+(mass-.5)*.20*meadow,0,1))
# Shared PBR rock/snow response, with unchanged range geometry.
normals=np.array([v.normal[:] for v in g.data.vertices],np.float32);drain=np.empty(len(a),np.float32);g.data.attributes['mountain_drainage'].data.foreach_get('value',drain)
mountain=smooth((a[:,1]-260)/55);rockdesired=smooth((a[:,2]-(26+7*(noise2(a[:,0],a[:,1],16,31)-.5)))/17)*(.56+.44*smooth((.98-normals[:,2])/.25))
rock=original_attr(G,'alpine_rock');attr(g,'alpine_rock',rock*(1-.75*mountain)+np.maximum(rock*.55,rockdesired)*.75*mountain)
sundir=np.array([-400,-300,280],float);sundir/=np.linalg.norm(sundir);sunward=np.clip(normals@sundir,0,1)
snowline=52+5*sunward-10*drain+8*(noise2(a[:,0],a[:,1],9,6)-.5)
snow=smooth((a[:,2]-snowline)/8)*smooth((normals[:,2]-.40)/.44)
old=original_attr(G,'alpine_snow');attr(g,'alpine_snow',old*(1-.82*mountain)+snow*mountain*.82)
bpy.context.view_layer.update();target_ground_bvh=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get())
def rooted_surface_delta(points):
 delta=np.zeros(len(points),np.float32)
 ids=np.flatnonzero((points[:,1]>-4)&(points[:,1]<215))
 for j in ids:
  x,y=points[j,:2];ray=Vector((float(x),float(y),350));oldp,*_=source_ground_bvh.ray_cast(ray,Vector((0,0,-1)),750);newp,*_=target_ground_bvh.ray_cast(ray,Vector((0,0,-1)),750)
  if oldp is not None and newp is not None:delta[j]=newp.z-oldp.z
 return delta
report={'grass':{},'stones':{},'lighting':{},'notes':[]}
for name,block in GRASSES.items():
 o=bpy.data.objects[name];base=original(name);chunks=base.reshape((-1,block,3));root=chunks[:,1,:];rel=chunks-root[:,None,:];mass=masses(root[:,0],root[:,1]);cover=smooth((root[:,1]+3)/9)*(1-smooth((root[:,1]-160)/40));distance,level,side,which=fields.bank(root[:,0],root[:,1]);ledges,bars,d,l=fields.bank_patches(root[:,0],root[:,1])
 source_height=np.maximum(.015,np.max(rel[:,:,2],axis=1));wanted=(.085+.18*smooth((mass-.25)/.5))
 if name=='Low basal meadow foliage':wanted=.045+.055*mass
 if name=='Meadow to foothill transition':wanted=.09+.16*mass
 factor=np.clip(wanted/source_height,.72,2.10);factor=np.where(source_height>.30,np.minimum(factor,1.08),factor);factor=1+(factor-1)*cover
 factor*=1-.32*ledges-.35*bars;spread=1+(.08+.32*mass)*cover*(1-smooth((mass-.60)/.3)*.18)
 root_delta=rooted_surface_delta(root)
 out=chunks.copy();out[:,:,0]+=rel[:,:,0]*(spread[:,None]-1);out[:,:,1]+=rel[:,:,1]*(spread[:,None]-1);out[:,:,2]+=rel[:,:,2]*(factor[:,None]-1)+root_delta[:,None]
 o.data.vertices.foreach_set('co',out.astype(np.float32).ravel());o.data.update()
 seed=np.mod(np.sin(root[:,0]*91.37+root[:,1]*173.13)*43758.54,1);quiet=(1-smooth((mass-.25)/.20))*.34*cover
 underwater=(root[:,2]+root_delta+original_attr(name,'tree_habitat_z').reshape((-1,block))[:,1]<level+.025)&(distance<.35)
 thin=original_attr(name,'tree_habitat_thin').reshape((-1,2*(block//3-1)));clear=(seed<quiet)|(seed<ledges*.30)|(seed<bars*.65)|underwater
 if name=='Low basal meadow foliage':clear=(seed<quiet*.25)|(seed<bars*.45)|underwater
 thin|=clear[:,None];attr(o,'tree_habitat_thin',thin.ravel(),domain='FACE',kind='BOOLEAN')
 attr(o,'valley_sward',np.clip(original_attr(name,'valley_sward')+np.repeat((mass-.5)*.20*cover,block),0,1))
 print('ROOTED GRASS',name,flush=True)
 report['grass'][name]={'existing_blades':len(root),'local_height_multiplier':[float(factor.min()),float(factor.max())],'quiet_ground_and_bank_blades_affected':int(clear.sum())}
for name in meta['meshes']:
 if not name.startswith('Meadow blooms - '):continue
 o=bpy.data.objects[name];a=original(name);new=a.copy();new[:,2]+=rooted_surface_delta(a);o.data.vertices.foreach_set('co',new.ravel());o.data.update()
 # Keep the existing palette/placements; exclude any roots newly exposed to flowing water.
 distance,water_level,side,which=fields.bank(new[:,0],new[:,1]);follow=original_attr(name,'tree_habitat_z');core=original_attr(name,'tree_habitat_core');wet=(new[:,2]+follow<water_level+.035)&(distance<.6);core[wet]=1;attr(o,'tree_habitat_core',core)
 # Preserve every species, scale, rotation and XY placement; roots follow the surface.
# Lighting reveals the forms; it is not baked into any material.
sun=bpy.data.objects['Simple afternoon sun'];sun.data.energy=3.25;sun.data.color=(1,.975,.935);sun.data.angle=math.radians(.85)
for mat in bpy.data.materials:
 if 'bounded alpine aerial perspective' in mat.name:
  mat.node_tree.nodes['Valley to distant range haze'].inputs['To Max'].default_value=.00090
look='None'
for candidate in ['AgX - Medium High Contrast','Medium High Contrast']:
 try:s.view_settings.look=candidate;look=candidate;break
 except (TypeError,ValueError):pass
s.view_settings.exposure=.10
terrain_shader=bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks'];terrain_shader.nodes['rock world texture scale'].inputs['Scale'].default_value=1/26;terrain_shader.nodes['Scanned geological relief'].inputs['Distance'].default_value=.72
snowrelief=terrain_shader.nodes['Snow broken by rock surface'].color_ramp
snowrelief.elements[0].position=.20;snowrelief.elements[0].color=(1,1,1,1);snowrelief.elements[-1].position=.75;snowrelief.elements[-1].color=(.40,.40,.40,1)
# Shallow-water direct lighting approximation: retain camera-ray refraction/absorption,
# but do not let the closed water shell blacken the bed's direct sunlight.
bpy.data.objects[W].visible_shadow=False
report['lighting']={'sun_energy':sun.data.energy,'sun_angle_degrees':math.degrees(sun.data.angle),'look':s.view_settings.look,'exposure':s.view_settings.exposure,'distant_haze_max':.0009,'water_shadow_approximation':'water shell does not cast opaque shadows; camera refraction and absorption retained'}
# Existing rock maps are reused at a believable stone scale.
stone=bpy.data.materials.get('Habitat weathered limestone - existing maps')
if stone is None:stone=bpy.data.materials.new('Habitat weathered limestone - existing maps')
stone.use_nodes=True;t=stone.node_tree;t.nodes.clear();out=t.nodes.new('ShaderNodeOutputMaterial');p=t.nodes.new('ShaderNodeBsdfPrincipled');p.inputs['Roughness'].default_value=.86;p.inputs['Specular IOR Level'].default_value=.25;t.links.new(p.outputs[0],out.inputs['Surface'])
coord=t.nodes.new('ShaderNodeTexCoord');color=t.nodes.new('ShaderNodeTexImage');color.image=terrain_shader.nodes['rock scanned color'].image;color.projection='BOX';color.projection_blend=.30;t.links.new(coord.outputs['Generated'],color.inputs['Vector'])
hue=t.nodes.new('ShaderNodeHueSaturation');hue.inputs['Saturation'].default_value=.55;hue.inputs['Value'].default_value=.82;t.links.new(color.outputs['Color'],hue.inputs['Color']);t.links.new(hue.outputs['Color'],p.inputs['Base Color'])
height=t.nodes.new('ShaderNodeTexImage');height.image=terrain_shader.nodes['rock scanned height'].image;height.projection='BOX';height.projection_blend=.30;t.links.new(coord.outputs['Generated'],height.inputs['Vector']);b=t.nodes.new('ShaderNodeBump');b.inputs['Distance'].default_value=.035;b.inputs['Strength'].default_value=.35;t.links.new(height.outputs['Color'],b.inputs['Height']);t.links.new(b.outputs['Normal'],p.inputs['Normal'])
# A few selected stones are context, not an evenly spaced stone boundary.
col=bpy.data.collections.get('10 Stream habitat - reusable limestone')
if col:
 for o in list(col.objects):bpy.data.objects.remove(o,do_unlink=True)
else:col=bpy.data.collections.new('10 Stream habitat - reusable limestone');s.collection.children.link(col)
protos=[]
for k in range(4):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=.5);o=bpy.context.object
 for parent in list(o.users_collection):parent.objects.unlink(o)
 col.objects.link(o);o.name=f'SOURCE - habitat limestone {k+1}';o.hide_render=True;o.hide_set(True)
 for v in o.data.vertices:
  p=v.co.copy();p.x=math.copysign(abs(p.x)**.88,p.x);p.y=math.copysign(abs(p.y)**.88,p.y);p.z=math.copysign(abs(p.z)**.90,p.z)
  f=1+.12*math.sin(p.x*9+k*1.7)*math.cos(p.y*7-p.z*11+k);p*=f;p.x*=1+.10*math.sin(k+1);p.y*=.78+.11*math.cos(k);p.z*=.62+.09*math.sin(k*2);v.co=p
 for face in o.data.polygons:face.use_smooth=True
 o.data.materials.clear();o.data.materials.append(stone);protos.append(o)
for o in s.objects:
 if o.name.startswith('Bank limestone '):
  o.data.materials.clear();o.data.materials.append(stone)
  matrix=meta['objects'][o.name]['matrix'];x,y=matrix[0][3],matrix[1][3];p,n,face,dist=source_ground_bvh.ray_cast(Vector((x,y,350)),Vector((0,0,-1)),750)
  if p:o.location.z=matrix[2][3]+float(rooted_surface_delta(np.array([[x,y,p.z]],np.float32))[0])
bpy.context.view_layer.update();gb=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get())
def seat(x,y):
 p,n,*_=gb.ray_cast(Vector((float(x),float(y),350)),Vector((0,0,-1)),750);return p,n
def shoreline(k,y,side,offset):
 yy,c,l,r,z,f=src['sections'+str(k)].T;x=float(np.interp(y,yy,l if side<0 else r));x+=side*offset*float(np.interp(y,yy,f));return x,y
large=[(0,7,-1,.12,.70),(0,17,1,-.10,.88),(0,25,-1,.25,.54),(1,74,-1,.10,.60),(1,115,1,.12,.46)]
placements=[]
for i,(k,y,side,off,size) in enumerate(large):
 x,y=shoreline(k,y,side,off);p,n=seat(x,y)
 if p is None:continue
 q=world_to_camera_view(s,camera,p)
 if not(-.02<q.x<1.02 and -.02<q.y<.60):continue
 o=bpy.data.objects.new(f'Embedded limestone anchor {i+1:02}',protos[i%4].data);col.objects.link(o);o.location=(x,y,p.z+.10*size);o.scale=(size,size,size);o.rotation_euler=(.08*math.sin(i),.12*math.cos(i),i*2.13);placements.append(list(o.location))
# One low, half-buried foreground meadow stone, away from the water's course.
frame=camera.data.view_frame(scene=s);x0=min(v.x for v in frame);x1=max(v.x for v in frame);y0=min(v.y for v in frame);y1=max(v.y for v in frame)
direction=(camera.matrix_world.to_3x3()@Vector((x0+(x1-x0)*.11,y0+(y1-y0)*.19,frame[0].z))).normalized();p,n,face,dist=gb.ray_cast(camera.location,direction,300)
if p:
 o=bpy.data.objects.new('Low meadow limestone - partially buried',protos[2].data);col.objects.link(o);o.location=(p.x,p.y,p.z+.045);o.scale=(.72,.60,.62);o.rotation_euler=(.1,-.07,1.2);placements.append(list(o.location))
# Small sediment clusters use linked source geometry, preserving editable placements.
rng=np.random.default_rng(6119);vertices=[];rotations=[];scales=[]
for k,yc,side,count in [(0,10,-1,46),(0,24,1,22),(1,76,-1,26)]:
 for trial in range(count):
  y=float(rng.normal(yc,2.0 if k==0 else 3.0));x,y=shoreline(k,y,side,float(rng.uniform(-.55,.8)));p,n=seat(x,y)
  if p is None:continue
  q=world_to_camera_view(s,camera,p)
  if not(0<q.x<1 and 0<q.y<.56):continue
  size=float(rng.uniform(.065,.18) if k==0 else rng.uniform(.09,.22));vertices.append((x,y,p.z+size*.065));rotations.append((rng.uniform(-.3,.3),rng.uniform(-.3,.3),rng.uniform(0,math.tau)));scales.append((size,size,size))
# Foreground streambed detail follows refracted camera rays into the existing bed.
# The physical water material is unchanged; this is genuinely submerged geometry.
bank_count=len(vertices);water_bvh=BVHTree.FromObject(bpy.data.objects[W],bpy.context.evaluated_depsgraph_get());bed_rng=np.random.default_rng(9812);bed_sites=[]
for trial in range(7000):
 u=float(bed_rng.uniform(.45,1.10));v=float(bed_rng.uniform(-.10,.36));direction=(camera.matrix_world.to_3x3()@Vector((x0+(x1-x0)*u,y0+(y1-y0)*v,frame[0].z))).normalized()
 wp,normal,face,dist=water_bvh.ray_cast(camera.location,direction,300)
 if wp is None:continue
 gp,gn,gf,gd=gb.ray_cast(camera.location,direction,300)
 if gp is not None and gd<dist:continue
 if normal.dot(direction)>0:normal=-normal
 eta=1/1.333;cosine=-normal.dot(direction);k=1-eta*eta*(1-cosine*cosine)
 if k<=0:continue
 transmitted=(eta*direction+(eta*cosine-math.sqrt(k))*normal).normalized();bp,bn,bf,bd=gb.ray_cast(wp+transmitted*.003,transmitted,8)
 if bp is None or wp.z-bp.z<.17:continue
 if bed_rng.random()>.40+.60*float(noise2(np.array([bp.x]),np.array([bp.y]),2.8,99)[0]):continue
 if any((bp.x-px)**2+(bp.y-py)**2<.065**2 for px,py in bed_sites):continue
 size=float(bed_rng.uniform(.075,.185));vertices.append((bp.x,bp.y,bp.z+size*.065));rotations.append((bed_rng.uniform(-.3,.3),bed_rng.uniform(-.3,.3),bed_rng.uniform(0,math.tau)));scales.append((size,size,size));bed_sites.append((bp.x,bp.y))
 if len(bed_sites)>=900:break
mesh=bpy.data.meshes.new('Editable fluvial gravel placements');mesh.from_pydata(vertices,[],[]);o=bpy.data.objects.new('Fluvial pebbles - three restrained sediment pockets',mesh);col.objects.link(o)
for name,values in [('stone_rotation',rotations),('stone_scale',scales)]:
 at=mesh.attributes.new(name,'FLOAT_VECTOR','POINT');at.data.foreach_set('vector',np.asarray(values,np.float32).ravel())
group=bpy.data.node_groups.get('Habitat limestone point instances')
if group:bpy.data.node_groups.remove(group,do_unlink=True)
group=bpy.data.node_groups.new('Habitat limestone point instances','GeometryNodeTree');group.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry');group.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry');i=group.nodes.new('NodeGroupInput');out=group.nodes.new('NodeGroupOutput');points=group.nodes.new('GeometryNodeMeshToPoints');points.mode='VERTICES';group.links.new(i.outputs[0],points.inputs['Mesh']);info=group.nodes.new('GeometryNodeObjectInfo');info.inputs['Object'].default_value=protos[0];info.inputs['As Instance'].default_value=True;inst=group.nodes.new('GeometryNodeInstanceOnPoints');group.links.new(points.outputs['Points'],inst.inputs['Points']);group.links.new(info.outputs['Geometry'],inst.inputs['Instance'])
for name,target in [('stone_rotation','Rotation'),('stone_scale','Scale')]:
 at=group.nodes.new('GeometryNodeInputNamedAttribute');at.data_type='FLOAT_VECTOR';at.inputs['Name'].default_value=name;group.links.new(at.outputs['Attribute'],inst.inputs[target])
# Four reusable shapes, selected per point, avoid one repeated pebble silhouette.
join=group.nodes.new('GeometryNodeJoinGeometry')
for proto in protos:
 inf=group.nodes.new('GeometryNodeObjectInfo');inf.inputs['Object'].default_value=proto;inf.inputs['As Instance'].default_value=True;group.links.new(inf.outputs['Geometry'],join.inputs['Geometry'])
group.links.new(join.outputs['Geometry'],inst.inputs['Instance']);inst.inputs['Pick Instance'].default_value=True
random=group.nodes.new('FunctionNodeRandomValue');random.data_type='INT'
next(v for v in random.inputs if v.name=='Min' and v.type=='INT').default_value=0
next(v for v in random.inputs if v.name=='Max' and v.type=='INT').default_value=3
group.links.new(next(v for v in random.outputs if v.type=='INT'),inst.inputs['Instance Index'])
group.links.new(inst.outputs['Instances'],out.inputs[0]);mod=o.modifiers.new('Editable sediment pocket instances','NODES');mod.node_group=group
report['stones']={'reused_map_material':stone.name,'embedded_anchors':placements,'small_pebble_instances':len(vertices),'bank_pebbles':bank_count,'submerged_foreground_pebbles':len(bed_sites)}
assert np.array_equal(coords(g)[original(G)[:,1]>250],original(G)[original(G)[:,1]>250])
assert [list(v) for v in camera.matrix_world]==meta['camera']['matrix'] and camera.data.lens==meta['camera']['lens']
report['notes']=['Camera and broad geography preserved; range geometry unchanged.','Grass masses change actual leaf volumes and ground response rather than adding plants.','Bank shoulders, exposed toes, gravel and vegetation share the same waterline fields.','Local limestone maps reused for selected embedded anchors and three small gravel pockets.','Daylight remains editable; no lighting bake, clouds, animation, new tree work or application edits.']
bpy.context.view_layer.objects.active=camera;camera.select_set(True)
(ROOT/'habitat_structure_report.json').write_text(json.dumps(report,indent=2));bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
saved=(s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.cycles.use_denoising)
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=160;s.cycles.use_denoising=True;s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100;s.render.filepath=str(ROOT/'habitat_structure_preview.png');bpy.ops.render.render(write_still=True)
s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.cycles.use_denoising=saved;bpy.ops.wm.save_as_mainfile(filepath=str(FILE));print('STRUCTURE HERO RENDERED',json.dumps(report),flush=True)
