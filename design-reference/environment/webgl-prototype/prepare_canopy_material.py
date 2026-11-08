"""View-independent canopy material atlas from the approved authored blades. Never saves the master."""
import bpy, json, hashlib, math, numpy as np, time
from pathlib import Path
R=Path(__file__).resolve().parent; OUT=R.parents[2]/'public/assets/environment/alpine-prototype'; CACHE=R/'cache'; CACHE.mkdir(exist_ok=True)
MASTER=R.parent/'alpine-composition-01/echelon_alpine_composition_01.blend'
before=hashlib.sha256(MASTER.read_bytes()).hexdigest();bpy.ops.wm.open_mainfile(filepath=str(MASTER),load_ui=False);s=bpy.context.scene
names=['Foreground arching grass','Low basal meadow foliage','Midground meadow continuation','Meadow to foothill transition'];sources=[bpy.data.objects[n] for n in names]
for o in s.objects:o.hide_render=o not in sources
for o in sources:o.hide_render=False
s.render.engine='CYCLES';s.cycles.samples=8;s.cycles.use_denoising=False;s.render.film_transparent=True
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU'
bounds=[-200.,-38.,150.,280.];width=3072;height=round(width*318/350)
camdata=bpy.data.cameras.new('Delivery canopy material capture');camdata.type='ORTHO';camdata.ortho_scale=350
cam=bpy.data.objects.new('Delivery canopy material capture',camdata);s.collection.objects.link(cam);cam.location=(-25,121,500);cam.rotation_euler=(0,0,0);s.camera=cam
s.render.resolution_x=width;s.render.resolution_y=height;s.render.resolution_percentage=100;s.render.pixel_aspect_x=s.render.pixel_aspect_y=1
s.use_nodes=False;s.view_settings.view_transform='Standard';s.view_settings.look='None';s.view_settings.exposure=0;s.view_settings.gamma=1
# Replace only in this unsaved background process: unlit source base colors, no afternoon baked into material.
material_pairs=[]
for o in sources:
 for idx,original in enumerate(list(o.data.materials)):
  m=original.copy();m.name='Unlit canopy '+original.name;bsdf=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');color=tuple(bsdf.inputs['Base Color'].default_value)
  n=m.node_tree.nodes;n.clear();em=n.new('ShaderNodeEmission');em.inputs['Color'].default_value=color;out=n.new('ShaderNodeOutputMaterial');m.node_tree.links.new(em.outputs[0],out.inputs['Surface']);o.data.materials[idx]=m;material_pairs.append(m)
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='8';s.render.filepath=str(OUT/'meadow-canopy-color.png')
print('CANOPY COLOR',width,height,flush=True);start=time.time();bpy.ops.render.render(write_still=True)
for m in material_pairs:
 n=m.node_tree.nodes;n.clear();geo=n.new('ShaderNodeNewGeometry');scale=n.new('ShaderNodeVectorMath');scale.operation='MULTIPLY_ADD';scale.inputs[1].default_value=(.5,.5,.5);scale.inputs[2].default_value=(.5,.5,.5);m.node_tree.links.new(geo.outputs['Normal'],scale.inputs[0]);em=n.new('ShaderNodeEmission');m.node_tree.links.new(scale.outputs[0],em.inputs['Color']);out=n.new('ShaderNodeOutputMaterial');m.node_tree.links.new(em.outputs[0],out.inputs['Surface'])
s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_depth='16';s.render.filepath=str(CACHE/'meadow-canopy-normal.exr');print('CANOPY NORMAL',flush=True);bpy.ops.render.render(write_still=True)
raw=bpy.data.images.load(s.render.filepath,check_existing=False);px=np.empty((width*height,4),np.float32);raw.pixels.foreach_get(px.ravel());alpha=px[:,3:4];px[:,:3]=np.where(alpha>1e-4,px[:,:3]/np.maximum(alpha,1e-4),np.array([.5,.5,1.]));px[:,:3]=np.clip(px[:,:3],0,1)
im=bpy.data.images.new('Canopy world normal data',width=width,height=height,alpha=True);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(px.ravel());im.filepath_raw=str(OUT/'meadow-canopy-normal.png');im.file_format='PNG';im.save()
assert hashlib.sha256(MASTER.read_bytes()).hexdigest()==before
report={'sourceSha256':before,'bounds':bounds,'resolution':[width,height],'color':'meadow-canopy-color.png','normal':'meadow-canopy-normal.png','normalSpace':'Blender world XYZ encoded 0..1; convert (x,z,-y) in shader','sources':names,'method':'Orthographic unlit source blade color/coverage and world normals; no new scatter, sunlight, flowers or terrain changes','seconds':time.time()-start,'masterUnchanged':True}
(OUT/'canopy-material.json').write_text(json.dumps(report,indent=2));(R/'canopy-material-report.json').write_text(json.dumps(report,indent=2));print('COMPLETE',report,flush=True)
