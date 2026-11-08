"""Environmental cohesion only; opens and updates the existing canonical blend."""
import bpy,numpy as np,json,math,sys,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parent;sys.path.insert(0,str(ROOT))
from cohesion_fields import CohesionFields,communities,smooth
from stream_network import StreamNetwork
FILE=ROOT/'echelon_alpine_composition_01.blend';bpy.ops.wm.open_mainfile(filepath=str(FILE));s=bpy.context.scene;camera=s.camera
G='Continuous meadow foothills and mountain range';W='Water inside carved channel - static graded surface'
GRASSES={'Foreground arching grass':18,'Low basal meadow foliage':18,'Midground meadow continuation':12,'Meadow to foothill transition':12}
def coords(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
def digest(a):return hashlib.sha256(a.tobytes()).hexdigest()
def attr(o,name,values,domain='POINT',kind='FLOAT'):
 at=o.data.attributes.get(name)
 if at is None:at=o.data.attributes.new(name,kind,domain)
 at.data.foreach_set('value',np.asarray(values).ravel())
archive=ROOT/'cohesion_source.npz';metadata=ROOT/'cohesion_source.json'
if not archive.exists():
 storage={};meta={'objects':{},'camera':{'matrix':[list(v) for v in camera.matrix_world],'lens':camera.data.lens},'lights':{},'meshes':{}}
 for o in s.objects:
  meta['objects'][o.name]={'matrix':[list(v) for v in o.matrix_world],'hide_render':o.hide_render,'hide':o.hide_get()}
  if o.type=='LIGHT':meta['lights'][o.name]=o.data.energy
 names=[G,W]+list(GRASSES)+[o.name for o in s.objects if o.name.startswith('Meadow blooms - ')]
 for i,name in enumerate(names):
  o=bpy.data.objects[name];a=coords(o);key='m'+str(i);storage[key]=a;record={'key':key,'hash':digest(a),'attributes':{}}
  for at in o.data.attributes:
   if at.name in ['streambed','damp_soil','meadow_vigor','valley_sward','tree_habitat_z','tree_habitat_thin','tree_habitat_core','plant_scale','plant_rotation']:
    vector=at.data_type=='FLOAT_VECTOR';boolean=at.data_type=='BOOLEAN';data=np.empty((len(at.data),3) if vector else len(at.data),np.float32 if not boolean else np.bool_);at.data.foreach_get('vector' if vector else 'value',data.ravel());ak=key+'_'+at.name;storage[ak]=data;record['attributes'][at.name]={'key':ak,'domain':at.domain,'kind':at.data_type}
  if name in GRASSES:
   indices=np.empty(len(o.data.polygons),np.int32);o.data.polygons.foreach_get('material_index',indices);storage[key+'_mats']=indices
  meta['meshes'][name]=record
 # Measure the actual saved tributary, including earlier local bank refinements.
 bpy.context.view_layer.update();bv=BVHTree.FromObject(bpy.data.objects[G],bpy.context.evaluated_depsgraph_get());stream=StreamNetwork().tributary;sections=[]
 for y in np.arange(44,222.1,.5):
  expected=stream.center(y);factor=stream.factor(y);level=stream.level(y);xs=np.linspace(expected-11*factor,expected+11*factor,221);zs=[]
  for x in xs:
   p,n,*_=bv.ray_cast(Vector((float(x),float(y),300)),Vector((0,0,-1)),650);zs.append(p.z)
  zs=np.array(zs);center=int(np.argmin(zs));left=center;right=center
  while left>0 and zs[left-1]<level:left-=1
  while right<len(xs)-1 and zs[right+1]<level:right+=1
  assert right>left
  wetleft=float(np.interp(level,[zs[left],zs[left-1]],[xs[left],xs[left-1]])) if left else xs[left]
  wetright=float(np.interp(level,[zs[right],zs[right+1]],[xs[right],xs[right+1]])) if right<len(xs)-1 else xs[right]
  sections.append([y,(wetleft+wetright)/2,wetleft,wetright,level,factor])
 storage['tributary_sections']=np.array(sections)
 # Routes connect existing entrance/porch thresholds; common ground stays small and irregular.
 entrances=[]
 for k in range(1,6):
  prefix=f'Village {k:02}';name=prefix+(' chapel entry' if k==1 else ' front door');o=bpy.data.objects[name];points=[o.matrix_world@p.co for p in o.data.vertices];p=sum(points,Vector())/len(points)
  wall=bpy.data.objects[prefix+' wall mass'];v=[wall.matrix_world@q.co for q in wall.data.vertices];front=(v[3]-v[0]).normalized();p-=front*(.75 if k in [2,4] else .38);entrances.append([p.x,p.y])
 paths=[[entrances[0],[33.0,110.2],[37.6,111.8],[40.6,116.4],entrances[1]],[[37.6,111.8],[43.8,119.9],[46.5,126.0],entrances[3]],[[33.0,110.2],[29.8,118.6],[28.8,126.3],entrances[2]],[[40.6,116.4],[38.8,126.5],[38.0,137.3],entrances[4]]]
 meta['paths']=paths
 np.savez_compressed(archive,**storage);metadata.write_text(json.dumps(meta,indent=2));print('COHESION SOURCE CAPTURED',flush=True)
meta=json.loads(metadata.read_text());src=np.load(archive);fields=CohesionFields(src['tributary_sections'],meta['paths'])
# Reapply only this pass from its starting geometry; preserve existing scene architecture.
for name,record in meta['meshes'].items():
 o=bpy.data.objects[name];o.data.vertices.foreach_set('co',src[record['key']].ravel());o.data.update()
 for at,record_at in record['attributes'].items():
  data=o.data.attributes[at];data.data.foreach_set('vector' if record_at['kind']=='FLOAT_VECTOR' else 'value',src[record_at['key']].ravel())
 if name in GRASSES:o.data.polygons.foreach_set('material_index',src[record['key']+'_mats'])
def base(name):return src[meta['meshes'][name]['key']]
def original_attr(name,at):return src[meta['meshes'][name]['attributes'][at]['key']].copy()
g=bpy.data.objects[G];a=base(G);dz=fields.terrain_offset(a);xwarp=fields.warp(a[:,0],a[:,1]);new=a.copy();new[:,0]+=xwarp;new[:,2]+=dz;g.data.vertices.foreach_set('co',new.ravel());g.data.update()
w=bpy.data.objects[W];water=base(W).copy();water[:,0]+=fields.warp(water[:,0],water[:,1]);w.data.vertices.foreach_set('co',water.ravel());w.data.update()
bars,eroded,level,shore,active=fields.shore_fields(a[:,0],a[:,1]);paths=fields.footpaths(a[:,0],a[:,1]);mesic,quiet,middle=communities(a[:,0],a[:,1])
attr(g,'streambed',np.maximum(original_attr(G,'streambed'),bars*.98));attr(g,'damp_soil',original_attr(G,'damp_soil')*(1-bars*.55))
attr(g,'meadow_vigor',np.clip(original_attr(G,'meadow_vigor')+.25*mesic-.18*quiet,0,1));attr(g,'valley_sward',np.clip(original_attr(G,'valley_sward')+.16*mesic-.13*quiet,0,1));attr(g,'habitat_path_wear',paths)
# Soil wear is an attribute of the existing ground, not a floating strip mesh.
t=bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks'];p=t.nodes['Terrain surface']
old=t.nodes.get('Cohesion worn village ground')
if old:
 original=old.inputs[1].links[0].from_socket;t.links.new(original,p.inputs['Base Color'])
for n in list(t.nodes):
 if n.name.startswith('Cohesion '):t.nodes.remove(n)
original=p.inputs['Base Color'].links[0].from_socket
# A narrow human path needs a finer field than the coarse distant terrain vertices.
# Bake only this authored mask; all surface textures remain the existing resources.
size=1024;xx,yy=np.meshgrid(np.linspace(19,63,size,dtype=np.float32),np.linspace(98,153,size,dtype=np.float32));pixels=fields.footpaths(xx.ravel(),yy.ravel());rgba=np.ones((size*size,4),np.float32);rgba[:,:3]=pixels[:,None]
im=bpy.data.images.get('Echelon hamlet - editable ground wear mask')
if im is None:im=bpy.data.images.new('Echelon hamlet - editable ground wear mask',width=size,height=size,alpha=True)
im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(rgba.ravel());im.filepath_raw=str(ROOT/'hamlet_ground_wear_mask.png');im.file_format='PNG';im.save();im.pack()
position=t.nodes.new('ShaderNodeNewGeometry');position.name='Cohesion world ground coordinates'
offset=t.nodes.new('ShaderNodeVectorMath');offset.name='Cohesion mask origin';offset.operation='SUBTRACT';offset.inputs[1].default_value=(19,98,0);t.links.new(position.outputs['Position'],offset.inputs[0])
scale=t.nodes.new('ShaderNodeVectorMath');scale.name='Cohesion mask metres';scale.operation='MULTIPLY';scale.inputs[1].default_value=(1/44,1/55,0);t.links.new(offset.outputs[0],scale.inputs[0])
mask=t.nodes.new('ShaderNodeTexImage');mask.name='Cohesion foot traffic';mask.image=im;mask.extension='CLIP';mask.interpolation='Linear';t.links.new(scale.outputs[0],mask.inputs['Vector'])
earth=t.nodes.new('ShaderNodeMixRGB');earth.name='Cohesion trampled soil palette';earth.blend_type='MIX';earth.inputs[0].default_value=.42;t.links.new(t.nodes['earth scanned color'].outputs['Color'],earth.inputs[1]);t.links.new(t.nodes['gravel scanned color'].outputs['Color'],earth.inputs[2])
wear=t.nodes.new('ShaderNodeMixRGB');wear.name='Cohesion worn village ground';t.links.new(mask.outputs['Color'],wear.inputs[0]);t.links.new(original,wear.inputs[1]);t.links.new(earth.outputs[0],wear.inputs[2]);t.links.new(wear.outputs[0],p.inputs['Base Color'])
report={'grass':{},'flowers':{},'paths':meta['paths'],'notes':[]}
for name,block in GRASSES.items():
 o=bpy.data.objects[name];a=base(name);chunks=a.reshape((-1,block,3));roots=chunks[:,1,:];mesic,quiet,middle=communities(roots[:,0],roots[:,1]);wear=fields.footpaths(roots[:,0],roots[:,1]);bars,eroded,level,shore,active=fields.shore_fields(roots[:,0],roots[:,1])
 shift=fields.warp(roots[:,0],roots[:,1]);dz=fields.terrain_offset(roots+np.array([0,0,.016],dtype=np.float32))
 height=np.clip(1+.24*mesic-.23*quiet-.72*wear-.53*bars,.18,1.25);spread=1+.15*mesic-.08*quiet
 relative=chunks-roots[:,None,:];new=chunks.copy();new[:,:,0]+=shift[:,None]+relative[:,:,0]*(spread[:,None]-1);new[:,:,1]+=relative[:,:,1]*(spread[:,None]-1);new[:,:,2]+=dz[:,None]+relative[:,:,2]*(height[:,None]-1)
 o.data.vertices.foreach_set('co',new.astype(np.float32).ravel());o.data.update();attr(o,'valley_sward',np.repeat(np.clip(original_attr(name,'valley_sward').reshape((-1,block))[:,1]+.16*mesic-.13*quiet,0,1),block))
 seed=np.mod(np.sin(roots[:,0]*91.7+roots[:,1]*151.1)*45758.43,1);submerged=(roots[:,2]+dz<level+.035)&(active>.02)&(shore<.8)
 thin=original_attr(name,'tree_habitat_thin').reshape((-1,2*(block//3-1)));thin|=np.repeat((submerged|(seed<wear*.58)|(seed<bars*.78))[:,None],thin.shape[1],axis=1);attr(o,'tree_habitat_thin',thin.ravel(),domain='FACE',kind='BOOLEAN')
 # Existing material families follow moist swales and sunny shoulders, not isolated circular colonies.
 ids=src[meta['meshes'][name]['key']+'_mats'].reshape((-1,2*(block//3-1))).copy();rich=(seed<mesic*.65);dry=(seed<quiet*.58);ids[rich,:]=np.where(seed[rich]>.30,1,3)[:,None];ids[dry,:]=np.where(seed[dry]>.2,2,4)[:,None];o.data.polygons.foreach_set('material_index',ids.astype(np.int32).ravel())
 report['grass'][name]={'existing_blades':len(roots),'wet_bank_blades_hidden':int(submerged.sum()),'footpath_affected_blades':int((wear>.05).sum())}
# Candidate sites share the existing drainage folds, not circular species colonies.
bpy.context.view_layer.update();habitat_ground=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get());habitat_water=BVHTree.FromObject(w,bpy.context.evaluated_depsgraph_get())
rng=np.random.default_rng(8934);candidate_sites=[]
for trial in range(5000):
 x=float(rng.uniform(-73,64));y=float(rng.uniform(48,116));mes,q,mid=communities(np.array([x]),np.array([y]));prob=.16+.66*float(mes[0])
 if rng.random()>prob or float(fields.footpaths(np.array([x]),np.array([y]))[0])>.15:continue
 p,n,*_=habitat_ground.ray_cast(Vector((x,y,300)),Vector((0,0,-1)),650);wp,*_=habitat_water.ray_cast(Vector((x,y,300)),Vector((0,0,-1)),650)
 if p is None or n.z<.72 or (wp is not None and p.z<wp.z+.18):continue
 q=world_to_camera_view(s,camera,p)
 if not(.045<q.x<.96 and .39<q.y<.53):continue
 # Simple spacing across the common pool prevents coincident stems while allowing interweaving.
 if any((x-qx)**2+(y-qy)**2<.75**2 for qx,qy,qz in candidate_sites):continue
 candidate_sites.append((x,y,p.z-.012))
 if len(candidate_sites)>=180:break
assert len(candidate_sites)>=135
rng.shuffle(candidate_sites);site_index=0
# All original flower points/species remain. Immediate foreground is untouched.
for name,record in meta['meshes'].items():
 if not name.startswith('Meadow blooms - '):continue
 o=bpy.data.objects[name];a=base(name);dz=fields.terrain_offset(a+np.array([0,0,.012],np.float32));new=a.copy();new[:,0]+=fields.warp(a[:,0],a[:,1]);new[:,2]+=dz;o.data.vertices.foreach_set('co',new.ravel());o.data.update()
 mesic,quiet,middle=communities(a[:,0],a[:,1]);wear=fields.footpaths(a[:,0],a[:,1]);bars,eroded,level,shore,active=fields.shore_fields(a[:,0],a[:,1]);core=original_attr(name,'tree_habitat_core');wet=(new[:,2]<level+.025)&(active>.02)&(shore<.8);core[wet|(wear>.45)]=1;attr(o,'tree_habitat_core',core)
 # Allocate some effectively unreadable distant points to the near-middle community.
 requested=70 if 'Marguerite' in name else (30 if 'Dandelion' in name else (5 if 'Clover' in name else 30))
 candidates=np.flatnonzero(a[:,1]>90);selected=candidates[np.argsort(a[candidates,1])[-min(requested,len(candidates)):]]
 for index in selected:
  new[index]=candidate_sites[site_index];site_index+=1;core[index]=0
 o.data.vertices.foreach_set('co',new.ravel());o.data.update();attr(o,'tree_habitat_core',core)
 zfollow=original_attr(name,'tree_habitat_z');zfollow[selected]=0;attr(o,'tree_habitat_z',zfollow)
 scales=original_attr(name,'plant_scale');enhance=.16 if 'Clover' in name else (.09 if 'Marguerite' in name else .04);scales*=np.maximum(.92,1+enhance*mesic-.04*quiet)[:,None];o.data.attributes['plant_scale'].data.foreach_set('vector',scales.ravel())
 assert np.array_equal(new[a[:,1]<35],a[a[:,1]<35]);report['flowers'][name]={'source_points':len(a),'new_water_or_path_exclusions':int((wet|(wear>.45)).sum()),'distant_points_reallocated_to_middle_meadow':len(selected)}
# Keep all existing background tree visibility exactly as approved (hidden).
bpy.context.view_layer.update();assert [list(v) for v in camera.matrix_world]==meta['camera']['matrix'] and camera.data.lens==meta['camera']['lens']
for name,energy in meta['lights'].items():assert bpy.data.objects[name].data.energy==energy
assert np.array_equal(coords(g)[base(G)[:,1]>250],base(G)[base(G)[:,1]>250])
report['notes']=['No new models or vegetation instances. Existing grass and flowers follow shared moisture and traffic fields.','Water and terrain receive the same local tributary deformation; main stream and mountain vertices remain unchanged.','Small gravel shelves and erosion pockets change actual bed/bank geometry and existing surface masks.','Hamlet ground wear connects actual entrances; existing blades shorten/thin along the same paths.','No camera, lighting, tree, building geometry, animation or application changes.']
(ROOT/'cohesion_report.json').write_text(json.dumps(report,indent=2));bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
saved=(s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.cycles.use_denoising)
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=128;s.cycles.use_denoising=True;s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100;s.render.filepath=str(ROOT/'cohesion_preview.png');bpy.ops.render.render(write_still=True)
s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.cycles.use_denoising=saved;bpy.ops.wm.save_as_mainfile(filepath=str(FILE));print('COHESION HERO RENDERED',json.dumps(report),flush=True)
