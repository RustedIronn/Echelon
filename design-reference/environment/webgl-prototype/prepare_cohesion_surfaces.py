import bpy, json, hashlib, time
from pathlib import Path
R=Path(__file__).resolve().parent
OUT=R.parents[2]/'public/assets/environment/alpine-prototype'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT/'geography.glb'))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.bake_type='EMIT'
s.render.bake.margin=8;s.render.bake.use_clear=True
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
 prefs.compute_device_type='OPTIX';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='OPTIX'
 s.cycles.device='GPU'
except Exception as e:print('GPU fallback',e,flush=True)
# Geometry-only occlusion, no baked sunlight or camera exposure. Water does not occlude ambient light.
for o in s.objects:
 o.hide_render=o.get('echelonRole') not in ['terrain','hamlet','stone'] or o.name=='sediment'
report={'sourceGeographySha256':hashlib.sha256((OUT/'geography.glb').read_bytes()).hexdigest(),'sourceMasterSha256':json.loads((OUT/'manifest.json').read_text())['sourceSha256'],'method':'Direction-independent geometry AO, no baked sun or sky illumination','surfaces':{}}
for name,res,distance in [('terrain-near',1024,2.0),('terrain-range',2048,32.0),('hamlet',1024,2.5)]:
 o=bpy.data.objects.get(name)
 if o is None:raise RuntimeError('Missing '+name)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 image=bpy.data.images.new(name+' AO delivery',width=res,height=res,alpha=False);image.colorspace_settings.name='Non-Color'
 originals=list(o.data.materials);o.data.materials.clear()
 material=bpy.data.materials.new(name+' geometry AO');material.use_nodes=True;n=material.node_tree.nodes;n.clear();l=material.node_tree.links
 ao=n.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=distance;ao.samples=16
 emission=n.new('ShaderNodeEmission');l.new(ao.outputs['AO'],emission.inputs['Color'])
 output=n.new('ShaderNodeOutputMaterial');l.new(emission.outputs[0],output.inputs['Surface'])
 target=n.new('ShaderNodeTexImage');target.image=image;n.active=target
 o.data.materials.append(material)
 print('BAKE',name,res,distance,flush=True);start=time.time();bpy.ops.object.bake(type='EMIT')
 image.filepath_raw=str(OUT/(name+'-ao.png'));image.file_format='PNG';image.save()
 o.data.materials.clear()
 for mat in originals:o.data.materials.append(mat)
 report['surfaces'][name]={'resolution':res,'distance':distance,'seconds':time.time()-start,'file':name+'-ao.png'}
 print('FINISHED',name,report['surfaces'][name],flush=True)
(R/'cohesion-bakes.json').write_text(json.dumps(report,indent=2))
