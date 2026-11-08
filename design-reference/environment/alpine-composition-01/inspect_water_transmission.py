import bpy
from pathlib import Path
r=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'));s=bpy.context.scene
w=bpy.data.objects['Water inside carved channel - static graded surface'];g=bpy.data.objects['Continuous meadow foothills and mountain range'];p=w.data.materials[0].node_tree.nodes['Clear alpine water']
for name in ['Base Color','Metallic','Roughness','IOR','Transmission Weight','Alpha']:
 print('WATER INPUT',name,p.inputs[name].default_value,'linked',p.inputs[name].is_linked,flush=True)
for ob in [w,g,bpy.data.objects['Fluvial pebbles - three restrained sediment pockets']]:print('VIS',ob.name,'transmission',ob.visible_transmission,'glossy',ob.visible_glossy,'shadow',ob.visible_shadow,'camera',ob.visible_camera,flush=True)
deps=bpy.context.evaluated_depsgraph_get();count=0
for inst in deps.object_instances:
 if inst.is_instance and inst.parent and inst.parent.original.name=='Fluvial pebbles - three restrained sediment pockets':count+=1
print('EVALUATED PEBBLES',count,flush=True)
w.hide_render=True
pref=bpy.context.preferences.addons['cycles'].preferences;pref.compute_device_type='OPTIX';pref.get_devices()
for d in pref.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=64;s.cycles.use_denoising=True;s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100;s.render.use_border=True;s.render.use_crop_to_border=True;s.render.border_min_x=.73;s.render.border_max_x=.995;s.render.border_min_y=.015;s.render.border_max_y=.27;s.render.filepath=str(r/'water_bed_geometry_diagnostic.png');bpy.ops.render.render(write_still=True)
