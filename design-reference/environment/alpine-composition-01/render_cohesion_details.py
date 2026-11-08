import bpy
from pathlib import Path
r=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'));s=bpy.context.scene
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=96;s.cycles.use_denoising=True;s.render.resolution_x=3840;s.render.resolution_y=2160;s.render.resolution_percentage=100;s.render.use_border=True;s.render.use_crop_to_border=True
for filename,bounds in [('cohesion_hamlet_detail.png',(.65,.83,.415,.56)),('cohesion_tributary_detail.png',(.28,.61,.38,.55))]:
 s.render.border_min_x,s.render.border_max_x,s.render.border_min_y,s.render.border_max_y=bounds;s.render.filepath=str(r/filename);bpy.ops.render.render(write_still=True)
