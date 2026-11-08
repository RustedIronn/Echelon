"""Replace only the foreground alder with the approved Norway spruce source."""
import bpy,json,hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parent;FILE=ROOT/'echelon_alpine_composition_01.blend'
bpy.ops.wm.open_mainfile(filepath=str(FILE));s=bpy.context.scene;c=s.camera
ob=bpy.data.objects.get('Black Alder - foreground-left stream shelter') or bpy.data.objects['Norway Spruce - foreground-left stream shelter']

def snapshot():
    out={'camera':{'matrix':[list(v) for v in c.matrix_world],'lens':c.data.lens},'objects':{}}
    for item in s.objects:
        if item==ob:continue
        r={'matrix':[list(v) for v in item.matrix_world],'hide_render':item.hide_render,'hide_viewport':item.hide_viewport}
        if item.type=='MESH':
            a=np.empty(len(item.data.vertices)*3,dtype=np.float32);item.data.vertices.foreach_get('co',a);r['geometry']=hashlib.sha256(a.tobytes()).hexdigest();r['materials']=[m.name if m else None for m in item.data.materials]
        out['objects'][item.name]=r
    return out
before=snapshot();source=bpy.data.objects['SOURCE - Norway Spruce'];height=max(v.co.z for v in source.data.vertices)
old={'name':ob.name,'mesh':ob.data.name,'scale':list(ob.scale),'location':list(ob.location),'rotation':list(ob.rotation_euler)}
ob.data=source.data;ob.name='Norway Spruce - foreground-left stream shelter';scale=6.0/height;ob.scale=(scale,)*3;ob.rotation_euler=(0,0,.35);ob['species']='Norway Spruce';ob['placement_intent']='Familiar compact evergreen silhouette at the foreground-left site; about 6 m above its authored ground plane.'
assert snapshot()==before,'Changes outside foreground tree.'
report={'replaced':old,'replacement':{'name':ob.name,'source':'SOURCE - Norway Spruce','scale':scale,'height_above_source_ground_m':6.0,'location':list(ob.location)},'protected_objects_verified':len(before['objects']),'camera_and_other_scene_objects_unchanged':True}
(ROOT/'foreground_tree_swap_preservation.json').write_text(json.dumps(before,indent=2))
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
settings=(s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.cycles.use_denoising)
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
    for d in prefs.devices:d.use=d.type!='CPU'
    s.cycles.device='GPU'
except Exception:s.cycles.device='CPU'
s.cycles.samples=128;s.cycles.use_denoising=True;s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100;s.render.filepath=str(ROOT/'foreground_spruce_preview.png');bpy.ops.render.render(write_still=True)
s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.cycles.use_denoising=settings
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
(ROOT/'foreground_tree_swap_report.json').write_text(json.dumps(report,indent=2))
print('FOREGROUND SPRUCE RENDERED',json.dumps(report),flush=True)
