import bpy,json,math,numpy as np,hashlib,struct,sys,time
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
import PyOpenColorIO as ocio
R=Path(__file__).resolve().parent;ROOT=R.parents[2];OUT=ROOT/'public/assets/environment/alpine-prototype';CACHE=R/'cache';MASTER=R.parent/'alpine-composition-01/echelon_alpine_composition_01.blend'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def log(x):print('PARITY',x,flush=True)
def array(data,prop,n,dtype=np.float32):
 a=np.empty((len(data),n),dtype);data.foreach_get(prop,a.ravel());return a
before=sha(MASTER);bpy.ops.wm.open_mainfile(filepath=str(MASTER));s=bpy.context.scene;dg=bpy.context.evaluated_depsgraph_get();report={'sourceSha256':before,'grass':[],'files':{},'lods':[]}
# The actual saved OCIO display/view/look, sampled into a log-domain 3D LUT.
config=ocio.Config.CreateFromFile(str(Path(bpy.utils.resource_path('LOCAL'))/'datafiles/colormanagement/config.ocio'))
transform=ocio.GroupTransform();transform.appendTransform(ocio.LookTransform(src='Linear Rec.709',dst='Linear Rec.709',looks=s.view_settings.look));transform.appendTransform(ocio.DisplayViewTransform(src='Linear Rec.709',display='sRGB',view=s.view_settings.view_transform));processor=config.getProcessor(transform).getDefaultCPUProcessor()
size=65;minimum=-12.;maximum=8.;axis=np.exp2(np.linspace(minimum,maximum,size,dtype=np.float32));b,g,r=np.meshgrid(axis,axis,axis,indexing='ij');colors=np.stack([r,g,b],axis=-1).reshape((-1,3)).copy();processor.apply(ocio.PackedImageDesc(colors,size,size*size,3));linear=np.where(colors<=.04045,colors/12.92,((colors+.055)/1.055)**2.4);rgba=np.ones((len(colors),4),np.float16);rgba[:,:3]=linear;rgba.tofile(OUT/'blender-display-lut.bin');report['display']={'size':size,'logMin':minimum,'logMax':maximum,'file':'blender-display-lut.bin','look':s.view_settings.look,'view':s.view_settings.view_transform,'exposure':2**s.view_settings.exposure,'encoding':'RGBA16F; x=R,y=G,z=B; linear display RGB'};log('saved actual Blender display transform')
# Recover denser authored growth, not offset copies or newly scattered positions.
seed=np.random.default_rng(7124);grass_prototypes=[];coverage=np.zeros((1024,1024),np.float32);coverage_bounds=[-200.,-38.,150.,280.]
for layer,(name,block,keep) in enumerate([('Foreground arching grass',18,.88),('Low basal meadow foliage',18,.85),('Midground meadow continuation',12,.35),('Meadow to foothill transition',12,.09)]):
 o=bpy.data.objects[name];points=array(o.data.vertices,'co',3);offset=o.data.attributes.get('tree_habitat_z')
 if offset:points[:,2]+=array(offset.data,'value',1)[:,0]
 blades=points.reshape((-1,block,3));roots=blades[:,1,:];choose=seed.random(len(blades))<keep;thin=o.data.attributes.get('tree_habitat_thin')
 if thin:choose&=~array(thin.data,'value',1,np.bool_).reshape((len(blades),-1)).all(axis=1)
 indices=np.flatnonzero(choose);valid=~array(thin.data,'value',1,np.bool_).reshape((len(blades),-1)).all(axis=1) if thin else np.ones(len(blades),np.bool_);uv=(roots[valid,:2]-np.array(coverage_bounds[:2]))/np.subtract(coverage_bounds[2:],coverage_bounds[:2]);inside=((uv>=0)&(uv<1)).all(axis=1);cell=(uv[inside]*1024).astype(np.int32);coverage+=np.bincount(cell[:,1]*1024+cell[:,0],minlength=1024*1024).reshape((1024,1024));material=np.array([p.material_index for p in o.data.polygons]).reshape((len(blades),-1))[:,0];records=[]
 template_ids=np.linspace(0,len(blades)-1,12,dtype=int);template_features=[]
 for variant,i in enumerate(template_ids):
  leaf=blades[i]-roots[i];tip=leaf[-2];angle=math.atan2(tip[1],tip[0]);ca,sa=math.cos(angle),math.sin(angle);length=max(.015,float(np.linalg.norm(tip[:2])));height=max(.015,float(leaf[:,2].max()));local=leaf.copy();local[:,0]=leaf[:,0]*ca+leaf[:,1]*sa;local[:,1]=-leaf[:,0]*sa+leaf[:,1]*ca;width=max(.001,float(np.max(abs(local[2::3,1]-local[0::3,1]))));local[:,0]/=length;local[:,1]/=width;local[:,2]/=height;template_features.append(float(tip[2]/height));faces=[]
  for step in range(block//3-1):
   a=step*3;faces.extend([(a,a+3,a+4,a+1),(a+1,a+4,a+5,a+2)])
  me=bpy.data.meshes.new('Authored blade with independent width');me.from_pydata(local,[],faces);me.update();obj=bpy.data.objects.new(f'grass-parity-{layer}-{variant}',me);s.collection.objects.link(obj);obj['layer']=layer;obj['variant']=variant;grass_prototypes.append(obj)
 template_features=np.array(template_features)
 for i in indices:
  leaf=blades[i]-roots[i];tip=leaf[-2];angle=math.atan2(tip[1],tip[0]);ca,sa=math.cos(angle),math.sin(angle);length=max(.015,float(np.linalg.norm(tip[:2])));height=max(.015,float(leaf[:,2].max()));side=-leaf[:,0]*sa+leaf[:,1]*ca;width=max(.001,float(np.max(abs(side[2::3]-side[0::3]))));error=abs(template_features-tip[2]/height);candidates=np.flatnonzero(error<error.min()+.025);variant=int(candidates[i%len(candidates)]);records.append([*roots[i],angle,length,height,int(material[i]),variant,width])
 filename=f'grass-parity-{layer}.bin';np.array(records,dtype='<f4').tofile(OUT/filename);report['grass'].append({'file':filename,'layer':layer,'count':len(records),'stride':9,'source':name,'samplingFraction':keep});log(name+' '+str(len(records)))
bpy.ops.object.select_all(action='DESELECT')
for obj in grass_prototypes:obj.select_set(True)
bpy.context.view_layer.objects.active=grass_prototypes[0];bpy.ops.export_scene.gltf(filepath=str(OUT/'grass-parity.glb'),export_format='GLB',use_selection=True,export_extras=True,export_materials='NONE',export_animations=False,export_lights=False,export_cameras=False)
# Coverage of the full authored habitat fills the subpixel canopy in the middle distance.
weights=np.exp(-np.arange(-5,6,dtype=np.float32)**2/(2*2.2**2));weights/=weights.sum()
for axis in [0,1]:
 pad=np.pad(coverage,[(5,5) if d==axis else (0,0) for d in [0,1]],mode='constant');blur=np.zeros_like(coverage)
 for k,weight in enumerate(weights):
  sl=[slice(None),slice(None)];sl[axis]=slice(k,k+1024);blur+=pad[tuple(sl)]*weight
 coverage=blur
cellarea=(coverage_bounds[2]-coverage_bounds[0])*(coverage_bounds[3]-coverage_bounds[1])/(1024*1024);cover=1-np.exp(-coverage/cellarea*.012);np.rint(cover*255).astype(np.uint8).tofile(OUT/'meadow-coverage.bin');manifest=json.loads((OUT/'manifest.json').read_text());report['coverage']={'file':'meadow-coverage.bin','size':1024,'bounds':coverage_bounds,'color':list(np.array(manifest['grassPalette']).mean(axis=0)*.83),'method':'Gaussian-filtered full authored blade-root density; no new vegetation placement'}
# Read the exact delivered water vertices; depth attributes must match their ordering.
raw=(OUT/'geography.glb').read_bytes();jslen=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+jslen]);binary=raw[28+jslen:]
waternode=next(n for n in doc['nodes'] if n.get('extras',{}).get('echelonRole')=='water');acc=doc['accessors'][doc['meshes'][waternode['mesh']]['primitives'][0]['attributes']['POSITION']];view=doc['bufferViews'][acc['bufferView']];offset=view.get('byteOffset',0)+acc.get('byteOffset',0);points=np.ndarray((acc['count'],3),dtype='<f4',buffer=binary,offset=offset,strides=(view.get('byteStride',12),4))
terrain=bpy.data.objects['Continuous meadow foothills and mountain range'];bed=BVHTree.FromObject(terrain,dg);depth=[]
for x,y,z in points:
 p,_,_,_=bed.ray_cast(Vector((float(x),float(-z),500)),Vector((0,0,-1)),1000);depth.append(max(0,float(y)-p.z) if p else 0)
np.array(depth,dtype='<f4').tofile(OUT/'water-depth.bin');report['water']={'depthFile':'water-depth.bin','count':len(depth),'depthRange':[min(depth),max(depth)],'method':'actual delivered vertex ordering; raycast to evaluated approved terrain'};log('water depth '+str(report['water']))
# Sediment remains at its authored positions; restore submerged wet-rock response.
node=next(n for n in doc['nodes'] if n.get('name')=='sediment');a=doc['accessors'][doc['meshes'][node['mesh']]['primitives'][0]['attributes']['POSITION']];v=doc['bufferViews'][a['bufferView']];sed=np.ndarray((a['count'],3),dtype='<f4',buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',12),4));surface=BVHTree.FromObject(bpy.data.objects['Water inside carved channel - static graded surface'],dg);wet=[]
for x,y,z in sed:
 hit,_,_,_=surface.ray_cast(Vector((float(x),float(-z),500)),Vector((0,0,-1)),1000);wet.append(float(np.clip((hit.z+.025-float(y))/.2,0,1)) if hit else 0)
np.array(wet,dtype='<f4').tofile(OUT/'sediment-wetness.bin');report['water']['sedimentWetnessFile']='sediment-wetness.bin';report['water']['sedimentVertices']=len(wet)
# Sky-only radiance from the saved physical world. No terrain, grass or lighting is baked.
for o in s.objects:o.hide_render=True
sky=next(n for n in s.world.node_tree.nodes if n.type=='TEX_SKY');report['sky']={'sunElevation':sky.sun_elevation,'sunRotation':sky.sun_rotation,'sunDiscInEnvironment':False};sky.sun_disc=False
camera_data=bpy.data.cameras.new('Sky radiance capture');camera_data.type='PANO';camera_data.panorama_type='EQUIRECTANGULAR';camera=bpy.data.objects.new('Sky radiance capture',camera_data);s.collection.objects.link(camera);camera.matrix_world=Matrix(((0,0,-1,0),(-1,0,0,0),(0,1,0,0),(0,0,0,1)));s.camera=camera;s.render.engine='CYCLES';s.cycles.samples=1;s.render.resolution_x=2048;s.render.resolution_y=1024;s.render.resolution_percentage=100;s.render.film_transparent=False;s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_mode='RGB';s.render.image_settings.color_depth='16';s.render.filepath=str(OUT/'afternoon-sky.exr');bpy.ops.render.render(write_still=True);report['sky']['file']='afternoon-sky.exr';log('saved physical sky radiance')
# Reuse imported delivery materials and create deliberate flower LODs, with unchanged placements.
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(OUT/'flowers.glb'))
allobjects=list(bpy.context.scene.objects);roots=[o for o in allobjects if o.get('species')];export=[]
def select(obs):
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0]
for root in roots:
 species=root['species'];meshes=[root] if root.type=='MESH' else [o for o in root.children_recursive if o.type=='MESH'];select(meshes)
 if len(meshes)>1:bpy.ops.object.join()
 high=bpy.context.object;high.parent=None;high['species']=species;high['lod']=0;export.append(high)
 for lod,ratio in [(1,.35),(2,.12)]:
  o=high.copy();o.data=high.data.copy();bpy.context.scene.collection.objects.link(o);o.name=species+' delivery LOD '+str(lod);select([o]);mod=o.modifiers.new('Distance-specific source detail','DECIMATE');mod.ratio=ratio;bpy.ops.object.modifier_apply(modifier=mod.name);o['species']=species;o['lod']=lod;export.append(o);report['lods'].append({'species':species,'lod':lod,'triangles':sum(len(p.vertices)-2 for p in o.data.polygons)})
select(export);bpy.ops.export_scene.gltf(filepath=str(OUT/'flowers-lod.glb'),export_format='GLB',use_selection=True,export_extras=True,export_animations=False,export_lights=False,export_cameras=False)
report['masterUnchanged']=sha(MASTER)==before;assert report['masterUnchanged'];report['files']={p.name:p.stat().st_size for p in OUT.iterdir() if p.name in ['blender-display-lut.bin','water-depth.bin','sediment-wetness.bin','meadow-coverage.bin','afternoon-sky.exr','flowers-lod.glb'] or p.name.startswith('grass-parity-')};(OUT/'parity.json').write_text(json.dumps(report,indent=2));(R/'parity-delivery-report.json').write_text(json.dumps(report,indent=2));log('COMPLETE master unchanged')
