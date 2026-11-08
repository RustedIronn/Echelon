import bpy,json,hashlib,shutil
import numpy as np
from pathlib import Path
r=Path(r'D:\Projects\Echelon\design-reference\environment\alpine-composition-01')
bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'))
s=bpy.context.scene;b=json.loads((r/'foreground_tree_swap_preservation.json').read_text())
assert [list(v) for v in s.camera.matrix_world]==b['camera']['matrix'] and s.camera.data.lens==b['camera']['lens']
for name,old in b['objects'].items():
    o=bpy.data.objects[name];assert [list(v) for v in o.matrix_world]==old['matrix'] and o.hide_render==old['hide_render'] and o.hide_viewport==old['hide_viewport'],name
    if o.type=='MESH':
        a=np.empty(len(o.data.vertices)*3,dtype=np.float32);o.data.vertices.foreach_get('co',a);assert hashlib.sha256(a.tobytes()).hexdigest()==old['geometry'],name
        assert [m.name if m else None for m in o.data.materials]==old['materials']
ob=bpy.data.objects['Norway Spruce - foreground-left stream shelter'];assert ob.data==bpy.data.objects['SOURCE - Norway Spruce'].data
report=json.loads((r/'foreground_tree_swap_report.json').read_text());report['fresh_file_verification']={'foreground_species':'Norway Spruce','other_objects_unchanged':len(b['objects']),'camera_unchanged':True,'reopened_from_disk':True};(r/'foreground_tree_swap_report.json').write_text(json.dumps(report,indent=2))
shutil.copyfile(r/'foreground_spruce_preview.png',r/'composition_preview.png')
print('FOREGROUND SWAP VERIFIED',json.dumps(report['fresh_file_verification']))
