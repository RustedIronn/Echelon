import bpy
from pathlib import Path
R=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(R/'echelon_alpine_composition_01.blend'));s=bpy.context.scene;t=bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks'];e=t.nodes.new('ShaderNodeEmission');t.links.new(t.nodes['Cohesion foot traffic'].outputs['Color'],e.inputs['Color'])
for n in t.nodes:
 if n.type=='GROUP_OUTPUT':t.links.new(e.outputs[0],n.inputs['Surface'])
for o in s.objects:
 if o.name.startswith(('Meadow blooms','Foreground arching','Low basal','Midground meadow','Meadow to foothill')):o.hide_render=True
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=16;s.cycles.use_denoising=True;s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100;s.render.use_border=True;s.render.use_crop_to_border=True;s.render.border_min_x=.60;s.render.border_max_x=.96;s.render.border_min_y=.30;s.render.border_max_y=.56;s.render.filepath=str(R/'country_path_diagnostic.png');bpy.ops.render.render(write_still=True)
