"""Reproducible private WebGL derivatives; NEVER saves the approved Blender master.
Run: blender --background --factory-startup --disable-autoexec --python <this file>
All output is local audition material, not cleared for public redistribution.
"""
import bpy,numpy as np,math,json,hashlib,time,sys
from pathlib import Path
from mathutils import Matrix,Vector
R=Path(__file__).resolve().parent;ROOT=R.parents[2];OUT=ROOT/'public/assets/environment/alpine-prototype';OUT.mkdir(parents=True,exist_ok=True)
CACHE=R/'cache';CACHE.mkdir(exist_ok=True)
MASTER=R.parent/'alpine-composition-01/echelon_alpine_composition_01.blend';t0=time.perf_counter()
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for c in iter(lambda:f.read(8*1024*1024),b''):h.update(c)
 return h.hexdigest()
BASE=sha(MASTER);bpy.ops.wm.open_mainfile(filepath=str(MASTER));s=bpy.context.scene;dg=bpy.context.evaluated_depsgraph_get();cam=s.camera
rot=Matrix.Rotation(-math.pi/2,4,'X');invrot=rot.inverted();delivery=[];logs={};saved_matrices={}
def log(msg):print('PROTOTYPE',msg,flush=True)
def arr(data,prop,n,kind=np.float32):
 a=np.empty((len(data),n),kind);data.foreach_get(prop,a.ravel());return a

def duplicate(o,name,evaluated=True):
 mesh=bpy.data.meshes.new_from_object(o.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg) if evaluated else o.data.copy()
 p=bpy.data.objects.new(name,mesh);s.collection.objects.link(p);p.matrix_world=o.matrix_world.copy();return p

def select(obs):
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.hide_set(False);o.hide_render=False;o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0]

def decimate(o,ratio):
 select([o]);m=o.modifiers.new('Delivery simplification only','DECIMATE');m.ratio=ratio;bpy.ops.object.modifier_apply(modifier=m.name)

def stat(o):return {'vertices':len(o.data.vertices),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons)}
def export(obs,path):
 select(obs);bpy.ops.export_scene.gltf(filepath=str(OUT/path),export_format='GLB',use_selection=True,export_yup=True,export_apply=False,export_extras=True,export_materials='EXPORT',export_image_format='AUTO',export_texcoords=True,export_normals=True,export_cameras=False,export_lights=False,export_animations=False,export_attributes=True);log('exported '+path)

# Save actual evaluated GN instance transforms BEFORE creating delivery objects.
placements={};pebbles=[]
for i in dg.object_instances:
 if not i.is_instance or not i.show_self or not i.parent:continue
 parent=i.parent.original.name
 if parent.startswith('Meadow blooms - '):
  species=parent.replace('Meadow blooms - ','');mat=i.matrix_world.copy();pos=mat.translation
  # Representative foreground + middle-distance section, retaining authored placement.
  if pos.y<110 and pos.x>-60 and pos.x<65:
   placements.setdefault(species,[]).append([float(v) for col in (rot@mat@invrot).transposed() for v in col])
 elif parent.startswith('Fluvial pebbles'):
  pebbles.append((i.object.original,i.matrix_world.copy()))
projection=cam.calc_matrix_camera(dg,x=s.render.resolution_x,y=s.render.resolution_y)
sun=bpy.data.objects['Simple afternoon sun'];direction=rot.to_3x3()@(sun.rotation_euler.to_matrix()@Vector((0,0,1)))
manifest={'schema':1,'sourceSha256':BASE,'units':'metres','camera':{'matrix':[float(v) for col in (rot@cam.matrix_world).transposed() for v in col],'fov':math.degrees(2*math.atan(1/projection[1][1])),'near':cam.data.clip_start,'far':cam.data.clip_end,'aspect':s.render.resolution_x/s.render.resolution_y},'sun':{'direction':list(direction),'color':list(sun.data.color),'sourceEnergy':sun.data.energy},'flowers':placements,'grass':[],'statistics':logs,'scope':'Private static prototype; original placements, sampled vegetation; not a full ecosystem export.'}
# GPU baking, with documented fallback to CPU if unavailable.
s.render.engine='CYCLES';s.cycles.samples=8;s.render.bake.margin=8;s.render.bake.use_clear=True
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
 gpu=[d for d in prefs.devices if d.type=='OPTIX']
 for d in prefs.devices:d.use=d in gpu
 s.cycles.device='GPU' if gpu else 'CPU';logs['bakeDevices']=[d.name for d in gpu]
except Exception as e:s.cycles.device='CPU';logs['bakeDeviceNote']=str(e)
log('baking device '+s.cycles.device)

# During EMIT bakes only, replace Principled outputs by their BASE COLOR, not lit appearance.
def emission_setup(materials):
 visited=set();restore=[];created=[]
 def walk(tree):
  if not tree or tree.as_pointer() in visited:return
  visited.add(tree.as_pointer())
  for n in list(tree.nodes):
   if n.type=='GROUP':walk(n.node_tree)
   if n.type=='BSDF_PRINCIPLED':
    em=tree.nodes.new('ShaderNodeEmission');created.append((tree,em));base=n.inputs['Base Color']
    if base.is_linked:tree.links.new(base.links[0].from_socket,em.inputs['Color'])
    else:em.inputs['Color'].default_value=base.default_value
    for link in list(n.outputs['BSDF'].links):
     restore.append((tree,link.from_socket,link.to_socket));tree.links.new(em.outputs[0],link.to_socket)
 for m in materials:
  if m:walk(m.node_tree)
 return restore,created

def bake_color(o,name,size):
 select([o]);mats=[m for m in o.data.materials if m]
 cached=CACHE/(name+'.png');cache=json.loads((R/'bake-cache.json').read_text()) if (R/'bake-cache.json').exists() else {}
 reuse='--reuse-bakes' in sys.argv and cache.get('source')==BASE and cached.exists() and cache.get(name)==sha(cached)
 if reuse:
  im=bpy.data.images.load(str(cached),check_existing=False);mat=bpy.data.materials.new(name+' PBR');mat.use_nodes=True;t=mat.node_tree;p=t.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.88;tex=t.nodes.new('ShaderNodeTexImage');tex.image=im;t.links.new(tex.outputs['Color'],p.inputs['Base Color']);o.data.materials.clear();o.data.materials.append(mat);log('reused verified color bake '+name);return mat
 restore,created=emission_setup(mats);im=bpy.data.images.new(name,width=size,height=size,alpha=False);im.colorspace_settings.name='sRGB';nodes=[]
 for m in mats:
  node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=im;m.node_tree.nodes.active=node;nodes.append((m,node))
 hidden_state={item:item.hide_render for item in s.objects}
 for item in s.objects:item.hide_render=item!=o
 log('bake '+name+' '+str(stat(o)))
 bpy.ops.object.bake(type='EMIT')
 for item,hidden in hidden_state.items():item.hide_render=hidden
 im.filepath_raw=str(CACHE/(name+'.png'));im.file_format='PNG';im.save()
 for tree,a,b in restore:tree.links.new(a,b)
 for tree,n in created:tree.nodes.remove(n)
 for m,n in nodes:m.node_tree.nodes.remove(n)
 mat=bpy.data.materials.new(name+' PBR');mat.use_nodes=True;p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.88;tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;mat.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color']);o.data.materials.clear();o.data.materials.append(mat)
 return mat

def bake_surface(o,name):
 select([o]);states={item:item.hide_render for item in s.objects}
 for item in s.objects:item.hide_render=item!=o
 for role,kind,resolution in [('normal','NORMAL',1024 if name=='terrain-near' else 2048),('roughness','ROUGHNESS',512 if name=='terrain-near' else 1024)]:
  im=bpy.data.images.new(name+' '+role,width=resolution,height=resolution,alpha=False);im.colorspace_settings.name='Non-Color';targets=[]
  for m in o.data.materials:
   node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=im;m.node_tree.nodes.active=node;targets.append((m,node))
  s.render.bake.normal_space='TANGENT';log('surface bake '+name+' '+role);bpy.ops.object.bake(type=kind);im.file_format='PNG';im.filepath_raw=str(OUT/(name+'-'+role+'.png'));im.save()
  for m,node in targets:m.node_tree.nodes.remove(node)
 for item,hidden in states.items():item.hide_render=hidden

# One shared simplified mesh BEFORE partition: both delivery pieces retain identical seam vertices.
g=duplicate(bpy.data.objects['Continuous meadow foothills and mountain range'],'Delivery terrain');logs['terrainBefore']=stat(g);decimate(g,.16);logs['terrainAfter']=stat(g)
g.data.calc_loop_triangles();co=arr(g.data.vertices,'co',3);tri=arr(g.data.loop_triangles,'vertices',3,np.int32);pm=np.array([t.material_index for t in g.data.loop_triangles],np.int32);centrey=co[tri,1].mean(axis=1)
for near,name,size in [(True,'terrain-near',3072),(False,'terrain-range',4096)]:
 ids=np.flatnonzero(centrey<190 if near else centrey>=190);faces=tri[ids];used,indices=np.unique(faces,return_inverse=True);positions=co[used];me=bpy.data.meshes.new(name);me.from_pydata(positions,[],indices.reshape((-1,3)));me.update();o=bpy.data.objects.new(name,me);s.collection.objects.link(o)
 for m in g.data.materials:me.materials.append(m)
 me.polygons.foreach_set('material_index',pm[ids]);me.polygons.foreach_set('use_smooth',np.ones(len(me.polygons),np.bool_))
 for at in g.data.attributes:
  if at.domain=='POINT' and at.data_type=='FLOAT':
   values=arr(at.data,'value',1)[:,0];new=me.attributes.new(at.name,'FLOAT','POINT');new.data.foreach_set('value',values[used])
 uv=me.uv_layers.new(name='World XY delivery');bounds=[positions[:,:2].min(axis=0),positions[:,:2].max(axis=0)];uvcoord=(positions[:,:2]-bounds[0])/(bounds[1]-bounds[0]);uv.data.foreach_set('uv',uvcoord[indices].ravel());o['echelonRole']='terrain';o['terrainZone']='near' if near else 'range';o['xyBounds']=[*map(float,bounds[0]),*map(float,bounds[1])];bake_surface(o,name) if '--surface-only' in sys.argv else bake_color(o,name,size);delivery.append(o)
 log('terrain finished '+name)
bpy.data.objects.remove(g,do_unlink=True)

if '--surface-only' in sys.argv:
 assert sha(MASTER)==BASE
 (R/'surface-report.json').write_text(json.dumps({'sourceSha256':BASE,'masterUnchanged':True,'terrainBefore':logs['terrainBefore'],'terrainAfter':logs['terrainAfter']},indent=2));log('SURFACE COMPLETE');sys.exit(0)

# Hamlet atlas is surface color only. The editable master retains each building and component.
parts=[duplicate(o,'Delivery '+o.name) for o in list(s.objects) if o.type=='MESH' and o.name.startswith('Country ') and o.visible_get() and not o.hide_render]
select(parts);bpy.ops.object.join();hamlet=bpy.context.object;hamlet.name='hamlet';bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
if not hamlet.data.uv_layers:hamlet.data.uv_layers.new(name='Delivery atlas')
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.006);bpy.ops.object.mode_set(mode='OBJECT');bake_color(hamlet,'hamlet-atlas',2048);hamlet['echelonRole']='hamlet';logs['hamlet']=stat(hamlet);delivery.append(hamlet)

# Visible upper water surface only; exact authored positions / bends / elevations retained.
w=bpy.data.objects['Water inside carved channel - static graded surface'];co=arr(w.data.vertices,'co',3);faces=[tuple(p.vertices) for p in w.data.polygons if p.normal.z>.2];me=bpy.data.meshes.new('Authored water surface');me.from_pydata(co,[],faces);me.update();water=bpy.data.objects.new('water',me);s.collection.objects.link(water);water['echelonRole']='water';water.data.materials.append(bpy.data.materials.new('Runtime water placeholder'));delivery.append(water);logs['water']=stat(water)

# Rocks and approved foreground spruce. Hidden background trees remain absent.
for o in list(s.objects):
 if o.type!='MESH' or not o.visible_get() or o.hide_render:continue
 if o.name.startswith(('Bank limestone','Embedded limestone anchor','Low meadow limestone','Norway Spruce - foreground')):
  p=duplicate(o,'Delivery '+o.name);p['echelonRole']='tree' if 'Norway' in o.name else 'stone';delivery.append(p)
# Pebbles are tiny; merge their authored evaluated transforms into delivery geometry.
verts=[];faces=[]
for source,matrix in pebbles:
 offset=len(verts);verts.extend([tuple(matrix@v.co) for v in source.data.vertices]);faces.extend([tuple(offset+i for i in p.vertices) for p in source.data.polygons])
me=bpy.data.meshes.new('Authored sediment');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('sediment',me);s.collection.objects.link(o);o['echelonRole']='stone';delivery.append(o)

# Convert botanical materials to portable PBR, preserving source color and cutout imagery.
image_cache={}
def prepared_image(im,alpha_from_black=False):
 key=(im.name,alpha_from_black)
 if key in image_cache:return image_cache[key]
 copy=im.copy();copy.name='Delivery '+im.name;w,h=copy.size;cap=2048 if im.colorspace_settings.name=='sRGB' else 1024
 if max(w,h)>cap:copy.scale(max(1,round(w*cap/max(w,h))),max(1,round(h*cap/max(w,h))))
 if alpha_from_black:
  px=np.array(copy.pixels[:],np.float32).reshape((-1,4));px[:,3]=np.clip((px[:,:3].max(axis=1)-.008)/(.035-.008),0,1);rgba=bpy.data.images.new('Reconstructed source cutout',width=copy.size[0],height=copy.size[1],alpha=True);rgba.colorspace_settings.name=copy.colorspace_settings.name;rgba.pixels.foreach_set(px.ravel());rgba.update();copy=rgba
 copy.filepath_raw=str(CACHE/('image-'+str(len(image_cache))+'.png'));copy.file_format='PNG';copy.save();loaded=bpy.data.images.load(copy.filepath_raw,check_existing=False);loaded.colorspace_settings.name=copy.colorspace_settings.name;image_cache[key]=loaded;return loaded

def image_upstream(sock,seen=None):
 seen=seen or set()
 for link in sock.links:
  n=link.from_node
  if n.as_pointer() in seen:continue
  seen.add(n.as_pointer())
  if n.type=='TEX_IMAGE' and n.image:return n.image
  for inp in n.inputs:
   got=image_upstream(inp,seen)
   if got:return got
 return None

def portable_material(m,pink=False):
 mat=bpy.data.materials.new('Delivery '+m.name);mat.use_nodes=True;t=mat.node_tree;p=t.nodes.get('Principled BSDF');src=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) if m.use_nodes else None
 trees=[m.node_tree] if m.use_nodes else [];allimages=[]
 for tree in trees:
  for node in tree.nodes:
   if node.type=='GROUP' and node.node_tree and node.node_tree not in trees:trees.append(node.node_tree)
   if node.type=='TEX_IMAGE' and node.image:allimages.append(node.image)
 if src is None:src=next((node for tree in trees for node in tree.nodes if node.type=='BSDF_PRINCIPLED'),None)
 p.inputs['Base Color'].default_value=src.inputs['Base Color'].default_value if src else m.diffuse_color;p.inputs['Roughness'].default_value=.78
 if src:
  im=image_upstream(src.inputs['Base Color']) or next((im for im in allimages if '_diff' in im.name.lower()),None)
  if im:
   n=t.nodes.new('ShaderNodeTexImage');n.image=prepared_image(im,pink);n.image.colorspace_settings.name='sRGB';t.links.new(n.outputs['Color'],p.inputs['Base Color'])
   alpha=image_upstream(src.inputs['Alpha']) or next((im for im in allimages if '_alpha' in im.name.lower()),None)
   if pink or (alpha and alpha==im):t.links.new(n.outputs['Alpha'],p.inputs['Alpha'])
   elif alpha:
    a=t.nodes.new('ShaderNodeTexImage');a.image=prepared_image(alpha);a.image.colorspace_settings.name='Non-Color';t.links.new(a.outputs['Color'],p.inputs['Alpha'])
  normal=image_upstream(src.inputs['Normal']) or next((im for im in allimages if '_nor' in im.name.lower()),None)
  if normal and ('nor' in normal.name.lower() or normal.name.startswith('N4K')):
   n=t.nodes.new('ShaderNodeTexImage');n.image=prepared_image(normal);n.image.colorspace_settings.name='Non-Color';nrm=t.nodes.new('ShaderNodeNormalMap');t.links.new(n.outputs['Color'],nrm.inputs['Color']);t.links.new(nrm.outputs['Normal'],p.inputs['Normal'])
 mat.diffuse_color=p.inputs['Base Color'].default_value;mat.use_backface_culling=False;mat.surface_render_method='DITHERED';return mat

# Preserve actual source meshes at explicit delivery ratios; no scatter regeneration.
flowers=[]
for species in placements:
 source=bpy.data.objects['SOURCE - '+species];o=duplicate(source,'flower-'+species,False);o.matrix_world=Matrix.Identity(4);before=stat(o)
 ratio={'Marguerite':.6,'Dandelion':.3,'Red Clover':.35,'Carthusian Pink':1}[species]
 if ratio<1:decimate(o,ratio)
 for i,m in enumerate(list(o.data.materials)):o.data.materials[i]=portable_material(m,species=='Carthusian Pink')
 o['species']=species;o['echelonRole']='flowerPrototype';flowers.append(o);logs[species]={'source':before,'delivery':stat(o),'instances':len(placements[species])}
export(flowers,'flowers.glb')

# Actual authored grass roots and variations, reused through a small set of blade shapes.
prototypes=[];palette=[];seed=np.random.default_rng(7124)
configs=[('Foreground arching grass',18,.42),('Low basal meadow foliage',18,.35),('Midground meadow continuation',12,.12),('Meadow to foothill transition',12,.018)]
for layer,(name,block,keep) in enumerate(configs):
 source=bpy.data.objects[name];points=arr(source.data.vertices,'co',3);offset=source.data.attributes.get('tree_habitat_z')
 if offset:points[:,2]+=arr(offset.data,'value',1)[:,0]
 blades=points.reshape((-1,block,3));roots=blades[:,1,:];choose=seed.random(len(blades))<keep
 thin=source.data.attributes.get('tree_habitat_thin')
 if thin:
  flags=arr(thin.data,'value',1,np.bool_).reshape((len(blades),-1));choose&=~flags.all(axis=1)
 ids=np.flatnonzero(choose);records=[];material=np.array([p.material_index for p in source.data.polygons]).reshape((len(blades),-1))[:,0]
 if not palette:
  for mat in source.data.materials:
   bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');palette.append(list(bsdf.inputs['Base Color'].default_value)[:3])
 for variant,index in enumerate(np.linspace(0,len(blades)-1,12,dtype=int)):
  b=blades[index]-roots[index];tip=b[-2];length=max(.015,float(np.linalg.norm(tip[:2])));height=max(.015,float(b[:,2].max()));angle=math.atan2(tip[1],tip[0]);ca,sa=math.cos(angle),math.sin(angle);local=b.copy();local[:,0]=(b[:,0]*ca+b[:,1]*sa)/length;local[:,1]=(-b[:,0]*sa+b[:,1]*ca)/length;local[:,2]/=height
  faces=[]
  for step in range(block//3-1):
   a=step*3;faces.extend([(a,a+3,a+4,a+1),(a+1,a+4,a+5,a+2)])
  me=bpy.data.meshes.new('Grass shape');me.from_pydata(local,[],faces);me.update();o=bpy.data.objects.new(f'grass-{layer}-{variant}',me);s.collection.objects.link(o);o['layer']=layer;o['variant']=variant;prototypes.append(o)
 for index in ids:
  b=blades[index]-roots[index];tip=b[-2];length=max(.015,float(np.linalg.norm(tip[:2])));height=max(.015,float(b[:,2].max()));records.append([*roots[index],math.atan2(tip[1],tip[0]),length,height,int(material[index]),index%12])
 data=np.asarray(records,dtype='<f4');fn=f'grass-{layer}.bin';data.tofile(OUT/fn);manifest['grass'].append({'file':fn,'layer':layer,'count':len(records),'stride':8,'source':name,'samplingFraction':keep});log('grass '+name+' '+str(len(records)))
manifest['grassPalette']=palette;export(prototypes,'grass.glb')
# Tree source PBR is already portable. Prepare its texture copies at delivery resolution.
for o in delivery:
 if o.get('echelonRole')=='tree':
  for i,m in enumerate(list(o.data.materials)):
   copied=m.copy()
   for node in copied.node_tree.nodes:
    if node.type=='TEX_IMAGE' and node.image:node.image=prepared_image(node.image)
   o.data.materials[i]=copied
 if o.get('echelonRole')=='stone':
  mat=bpy.data.materials.get('Delivery neutral weathered limestone')
  if not mat:
   mat=bpy.data.materials.new('Delivery neutral weathered limestone');mat.use_nodes=True;p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.24,.26,.24,1);p.inputs['Roughness'].default_value=.92
  o.data.materials.clear();o.data.materials.append(mat)
export(delivery,'geography.glb')
# Small reusable ground detail map, no time-dependent illumination baked into it.
for im in bpy.data.images:
 if im.name=='Grass04_diffuseOriginal.jpg':
  copy=im.copy();copy.scale(1024,1024);copy.filepath_raw=str(CACHE/'turf-detail.jpg');copy.file_format='JPEG';copy.save();break
# Approved reference for the local preview comparison, not scene geometry/background.
im=bpy.data.images.load(str(R.parent/'alpine-composition-01/grounding_pass_preview.png'),check_existing=False);_force=im.pixels[0];im.filepath_raw=str(OUT/'blender-reference.jpg');im.file_format='JPEG';im.save()
sys.path.insert(0,str(R));from pack_delivery import optimize
logs['packing']=[optimize(OUT/name,CACHE) for name in ['geography.glb','flowers.glb','grass.glb']]
logs['geographyObjects']={o.name:stat(o) for o in delivery};logs['elapsedSeconds']=time.perf_counter()-t0;logs['masterUnchanged']=sha(MASTER)==BASE;assert logs['masterUnchanged']
(R/'bake-cache.json').write_text(json.dumps({'source':BASE,**{name:sha(CACHE/(name+'.png')) for name in ['terrain-near','terrain-range','hamlet-atlas']}},indent=2))
manifest['files']={p.name:p.stat().st_size for p in OUT.iterdir() if p.suffix in ['.glb','.bin','.png','.jpg']};(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2));(R/'delivery-report.json').write_text(json.dumps(manifest,indent=2));log('COMPLETE '+str(logs['elapsedSeconds'])+' seconds')
