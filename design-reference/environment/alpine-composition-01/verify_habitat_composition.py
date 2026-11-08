"""Fresh-file checks of the localized habitat/hamlet pass; no scene regeneration."""
import bpy,json,hashlib,shutil
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from collections import Counter
ROOT=Path(__file__).resolve().parent
FILE=ROOT/'echelon_alpine_composition_01.blend'
bpy.ops.wm.open_mainfile(filepath=str(FILE));s=bpy.context.scene;c=s.camera
b=json.loads((ROOT/'habitat_scene_baseline.json').read_text());r=json.loads((ROOT/'habitat_composition_report.json').read_text());archive=np.load(ROOT/'habitat_grounding_baseline.npz')
def co(o):
    a=np.empty((len(o.data.vertices),3),dtype=np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
def digest(a):return hashlib.sha256(a.tobytes()).hexdigest()
def smooth(a):
    a=np.clip(a,0,1);return a*a*(3-2*a)
def delta(x,y):
    r2=((x-43)/34)**2+((y-146)/35)**2
    d=-1.55*np.exp(-r2)*smooth((x-8)/16)*smooth((y-65)/25)*(1-smooth((y-165)/30))*smooth((9-r2)/3)
    return np.where((x>8)&(y>65)&(y<195)&(r2<9),d,0)
assert [list(v) for v in c.matrix_world]==b['camera']['matrix'] and c.data.lens==b['camera']['lens']
following=set(b['following']);unchanged_meshes=0
for name,h in b['mesh_hashes'].items():
    if name not in bpy.data.objects:
        assert name.startswith(('HELD - ','Larch - ','Norway Spruce - ','Fir A - ','Fir B - ','Fir C - ')),name
        continue
    o=bpy.data.objects[name];a=co(o)
    if name in following:
        item=b['following'][name];idx=archive[item['key']+'_indices'];z=archive[item['key']+'_z']
        assert digest(a[:,:2].copy())==b['mesh_xy_hashes'][name],name
        assert np.max(abs(a[idx,2]-(z+delta(a[idx,0],a[idx,1])).astype(np.float32)),initial=0)<3e-6,name
        a[idx,2]=z;assert digest(a)==h,('Changes outside authorized field',name)
        for attr,old in item.get('attributes',{}).items():
            values=np.empty((len(o.data.attributes[attr].data),3),dtype=np.float32);o.data.attributes[attr].data.foreach_get('vector',values.ravel());assert digest(values)==old,(name,attr)
    else:
        assert digest(a)==h,('Unexpected source/stream/building geometry change',name);unchanged_meshes+=1
for name,old in b['objects'].items():
    if old['type']=='LIGHT':
        o=bpy.data.objects[name];assert o.data.energy==old['energy'] and [list(row) for row in o.matrix_world]==old['matrix']
ground=bpy.data.objects['Continuous meadow foothills and mountain range'];a=co(ground)
assert digest(a[a[:,1]>=225].copy())==b['mountain_y225_plus_hash']
gb=BVHTree.FromObject(ground,bpy.context.evaluated_depsgraph_get())
def height(x,y):
    p,*_=gb.ray_cast(Vector((x,y,300)),Vector((0,0,-1)),600);assert p is not None;return p.z
foundations=[];steps=[]
for i in range(1,6):
    prefix=f'Village {i:02}';o=bpy.data.objects[prefix+' stone foundation'];pts=[o.matrix_world@v.co for v in o.data.vertices];bottom=min(p.z for p in pts)
    burial=[height(p.x,p.y)-p.z for p in pts if abs(p.z-bottom)<.001]
    foundations.append({'building':prefix,'minimum_foundation_burial_m':min(burial),'maximum_burial_m':max(burial)})
    assert min(burial)>-.015,('Floating foundation',prefix,min(burial))
    for ob in s.objects:
        if ob.name.startswith(prefix+' grounded entry step'):
            points=[ob.matrix_world@v.co for v in ob.data.vertices];low=min(p.z for p in points);gaps=[p.z-height(p.x,p.y) for p in points if abs(p.z-low)<.001]
            steps.append({'object':ob.name,'maximum_bottom_gap_m':max(gaps)})
flower_errors=[];flower_count=0
for ob in s.objects:
    if ob.name.startswith('Meadow blooms - '):
        flower_count+=len(ob.data.vertices)
        for v in ob.data.vertices:flower_errors.append(abs(v.co.z-height(v.co.x,v.co.y)+.012))
assert flower_count==2262 and max(flower_errors)<.02,(flower_count,max(flower_errors))
instances=Counter()
for instance in bpy.context.evaluated_depsgraph_get().object_instances:
    if instance.is_instance and instance.parent and instance.parent.original.name.startswith('Meadow blooms - '):instances[instance.parent.original.name]+=1
assert sum(instances.values())==2262
active=[o for o in bpy.data.collections['Authored trees and saplings - individual placements'].objects if not o.hide_render and not o.hide_get()]
fern_objects=list(bpy.data.collections['Ferns under foreground alder - editable shared meshes'].objects)
for ob in active+fern_objects:
    for mat in ob.data.materials:
        if mat and mat.use_nodes:
            for n in mat.node_tree.nodes:
                if n.type=='TEX_IMAGE' and n.image:assert all(n.image.size) and n.image.packed_file,(ob.name,n.image.name)
verification={'fresh_saved_file_reopened':True,'camera_and_lights_unchanged':True,'mountain_coordinates_y225_plus_unchanged':True,'stream_source_geometry_unchanged':True,'unchanged_meshes_verified':unchanged_meshes,'localized_field_only_verified':True,'flower_xy_and_rotation_scale_attributes_unchanged':True,'flower_instances':dict(instances),'max_flower_root_grounding_error_m':max(flower_errors),'hamlet_foundations':foundations,'step_bottom_gaps':steps,'active_trees':[{'name':o.name,'height_m':o.dimensions.z,'root':list(o.location)} for o in active],'fern_instances':len(fern_objects),'used_source_images_packed':True}
r['verification']=verification
(ROOT/'habitat_composition_report.json').write_text(json.dumps(r,indent=2),encoding='utf-8')
# Clean only unreferenced remnants from repeated source imports, retain every linked
# source/prototype/instance. This does not alter the visible scene.
bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=True,do_recursive=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
shutil.copyfile(ROOT/'habitat_composition_preview.png',ROOT/'composition_preview.png')
print('HABITAT VERIFIED',json.dumps(verification),flush=True)
