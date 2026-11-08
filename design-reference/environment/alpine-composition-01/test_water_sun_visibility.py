import bpy
from pathlib import Path
r=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'));s=bpy.context.scene;w=bpy.data.objects['Water inside carved channel - static graded surface'];w.visible_shadow=False
for n in w.data.materials[0].node_tree.nodes:
 if n.type=='VOLUME_ABSORPTION':print('VOLUME',list(n.inputs['Color'].default_value),n.inputs['Density'].default_value,flush=True)
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=64;s.cycles.use_denoising=True;s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100;s.render.use_border=True;s.render.use_crop_to_border=True;s.render.border_min_x=.73;s.render.border_max_x=.995;s.render.border_min_y=.015;s.render.border_max_y=.27;s.render.filepath=str(r/'water_transmitted_sun_test.png');bpy.ops.render.render(write_still=True)
