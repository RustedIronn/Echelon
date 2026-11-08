import bpy,json
from pathlib import Path
from mathutils import Vector
r=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'));s=bpy.context.scene
for name in ['Village 02 pitched roof','Village 02 visible fascia 04','Village 02 wall mass']:
 o=bpy.data.objects[name];print('BUILDING',name,'matrix',[list(v) for v in o.matrix_world],'dataworld',[list(o.matrix_world@v.co) for v in o.data.vertices],flush=True)
 ob=o.evaluated_get(bpy.context.evaluated_depsgraph_get());print('EVAL',[list(ob.matrix_world@v.co) for v in ob.data.vertices][:12],flush=True)
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=96;s.render.resolution_x=3840;s.render.resolution_y=2160;s.render.resolution_percentage=100;s.render.use_border=True;s.render.use_crop_to_border=True;s.render.border_min_x=.65;s.render.border_max_x=.83;s.render.border_min_y=.42;s.render.border_max_y=.56;s.render.filepath=str(r/'valley_hamlet_detail.png');bpy.ops.render.render(write_still=True)
