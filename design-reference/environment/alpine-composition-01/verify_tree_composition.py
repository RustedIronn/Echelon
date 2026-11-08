"""Fresh-file checks for the tree-only composition pass; no scene edits."""
import bpy,json,hashlib,shutil
import numpy as np
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'echelon_alpine_composition_01.blend'))
s=bpy.context.scene;c=s.camera;expected=json.loads((ROOT/'tree_composition_preservation.json').read_text())
assert c.name==expected['camera']['name'] and [list(r) for r in c.matrix_world]==expected['camera']['matrix'] and c.data.lens==expected['camera']['lens']
for name,old in expected['objects'].items():
    o=bpy.data.objects[name]
    assert [list(v) for v in o.matrix_world]==old['matrix'],name
    assert o.hide_render==old['hide_render'] and o.hide_viewport==old['hide_viewport'],name
    if o.type=='MESH':
        a=np.empty(len(o.data.vertices)*3,dtype=np.float32);o.data.vertices.foreach_get('co',a)
        assert hashlib.sha256(a.tobytes()).hexdigest()==old['coordinate_hash'],name
        assert len(o.data.polygons)==old['polygons'] and [m.name if m else None for m in o.data.materials]==old['materials'],name
        for key,digest in old.get('placement_attribute_hashes',{}).items():
            a=np.empty(len(o.data.attributes[key].data)*3,dtype=np.float32);o.data.attributes[key].data.foreach_get('vector',a);assert hashlib.sha256(a.tobytes()).hexdigest()==digest,(name,key)
    if o.type=='LIGHT':assert o.data.energy==old['energy'] and list(o.data.color)==old['color'],name
collection=bpy.data.collections['Authored trees and saplings - individual placements']
active=[o.name for o in collection.objects if not o.hide_render and not o.hide_get()]
held=[o.name for o in collection.objects if o.hide_render and o.hide_get()]
assert len(active)==5 and len(held)==4
instances=Counter()
for inst in bpy.context.evaluated_depsgraph_get().object_instances:
    if inst.is_instance and inst.parent and inst.parent.original.name.startswith('Meadow blooms - '):instances[inst.parent.original.name]+=1
assert sum(instances.values())==2262,dict(instances)
report=json.loads((ROOT/'tree_composition_report.json').read_text())
report['verification']={'reopened_from_disk':True,'non_tree_objects_verified':len(expected['objects']),'non_tree_geometry_material_assignments_transforms_visibility_unchanged':True,'flower_rotation_scale_attributes_unchanged':True,'evaluated_flower_instances':dict(instances),'active_tree_objects':active,'held_tree_objects':held,'camera_and_lights_unchanged':True}
(ROOT/'tree_composition_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
r=json.loads((ROOT/'ecosystem_integration_report.json').read_text())
r['trees']=[x for x in report['after'] if x['visible']];r['held_tree_placements']=[x for x in report['after'] if not x['visible']]
r['tree_composition_revision']='tree_composition_report.json'
r['saved_file_verification']['visible_tree_objects']=len(active);r['saved_file_verification']['held_tree_objects']=len(held)
r['notes']=[n for n in r['notes'] if not n.startswith('Four mature conifers')]
r['notes'].append('Tree composition revised: one left larch anchor, a smaller background spruce, one quiet right spruce, two associated saplings; alder, right larch and two other saplings held out.')
(ROOT/'ecosystem_integration_report.json').write_text(json.dumps(r,indent=2),encoding='utf-8')
shutil.copyfile(ROOT/'tree_composition_preview.png',ROOT/'composition_preview.png')
print('TREE PASS VERIFIED',json.dumps(report['verification']),flush=True)
