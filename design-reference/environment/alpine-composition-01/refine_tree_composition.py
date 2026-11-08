"""Tree-only composition refinement of the existing alpine scene."""
import bpy,json,hashlib,math
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parent;FILE=ROOT/'echelon_alpine_composition_01.blend'
bpy.ops.wm.open_mainfile(filepath=str(FILE));scene=bpy.context.scene;camera=scene.camera
collection=bpy.data.collections['Authored trees and saplings - individual placements'];tree_set=set(collection.objects)

def snapshot():
    state={'camera':{'name':camera.name,'matrix':[list(r) for r in camera.matrix_world],'lens':camera.data.lens},'objects':{}}
    for o in scene.objects:
        if o in tree_set:continue
        d={'type':o.type,'matrix':[list(v) for v in o.matrix_world],'hide_render':o.hide_render,'hide_viewport':o.hide_viewport}
        if o.type=='MESH':
            a=np.empty(len(o.data.vertices)*3,dtype=np.float32);o.data.vertices.foreach_get('co',a)
            d.update(vertex_count=len(o.data.vertices),polygons=len(o.data.polygons),coordinate_hash=hashlib.sha256(a.tobytes()).hexdigest(),materials=[m.name if m else None for m in o.data.materials])
            if o.name.startswith('Meadow blooms - '):
                attrs={}
                for key in ['plant_rotation','plant_scale']:
                    a=np.empty(len(o.data.attributes[key].data)*3,dtype=np.float32);o.data.attributes[key].data.foreach_get('vector',a);attrs[key]=hashlib.sha256(a.tobytes()).hexdigest()
                d['placement_attribute_hashes']=attrs
                d['node_groups']=[m.node_group.name for m in o.modifiers if m.type=='NODES']
        if o.type=='LIGHT':d.update(energy=o.data.energy,color=list(o.data.color))
        state['objects'][o.name]=d
    return state
baseline=snapshot();baseline_path=ROOT/'tree_composition_preservation.json'
if baseline_path.exists():assert json.loads(baseline_path.read_text())==baseline,'Non-tree changes detected.'
else:baseline_path.write_text(json.dumps(baseline,indent=2),encoding='utf-8')
report={'before':[],'after':[],'decisions':[]}
for o in collection.objects:report['before'].append({'name':o.name,'species':o.get('species'),'location':list(o.location),'rotation':list(o.rotation_euler),'scale':list(o.scale),'hidden_render':o.hide_render,'hidden_viewport':o.hide_get()})
ground=BVHTree.FromObject(bpy.data.objects['Continuous meadow foothills and mountain range'],bpy.context.evaluated_depsgraph_get())
water=BVHTree.FromObject(bpy.data.objects['Water inside carved channel - static graded surface'],bpy.context.evaluated_depsgraph_get())

def place(oldname,newname,x,y,size,yaw,intent):
    o=bpy.data.objects.get(oldname) or bpy.data.objects[newname]
    p,n,f,d=ground.ray_cast(Vector((x,y,300)),Vector((0,0,-1)),600)
    assert p is not None
    wet,nn,ff,dd=water.ray_cast(Vector((x,y,300)),Vector((0,0,-1)),600)
    assert not wet or wet.z<p.z-.15,'Tree would be in water'
    o.name=newname;o.location=(x,y,p.z-(.06 if o.get('species') in ['Norway Spruce','Larch'] else .08));o.scale=(size,)*3;o.rotation_euler=(0,0,yaw)
    o.hide_render=False;o.hide_set(False);o['placement_intent']=intent

def hold(oldname):
    o=bpy.data.objects.get(oldname) or bpy.data.objects['HELD - '+oldname]
    if not o.name.startswith('HELD - '):o.name='HELD - '+o.name
    o.hide_render=True;o.hide_set(True);o['placement_intent']='Withheld in tree composition review; retained editable, not rendered.'

place('Larch - left meadow shoulder','Larch - left slope anchor',-61,125,.92,1.85,'One stronger left-side anchor on a meadow shoulder, with young growth nearby.')
place('Norway Spruce - left foothill companion','Norway Spruce - distant left foothill remnant',-109,222,.82,-1.4,'Much farther back and laterally offset; smaller apparent crown supplies depth rather than a partner at the same distance.')
place('Norway Spruce - right valley edge beyond hamlet','Norway Spruce - quiet right hillside',88,174,.78,2.8,'Single subordinate conifer beyond and to the right of the hamlet; no second mature partner.')
hold('Larch - receding right foothill')
hold('Black Alder - single upper streamside tree')
place('Fir A - restrained young foothill growth','Fir A - young growth below left anchor',-58,122,1.0,1.3,'Young growth associated with the left larch shoulder, not an independent decorative clump.')
place('Fir C - restrained young foothill growth','Fir C - young growth behind left anchor',-69,139,.92,-.4,'Smaller recruit farther behind the anchor; unequal spacing and stature.')
hold('Fir B - restrained young foothill growth')
hold('Fir B - restrained young foothill growth.001')
report['decisions']=['Left: one larch anchor; spruce much farther back, laterally offset and partially tucked behind the anchor in camera space, with a much smaller apparent crown.','Right: one quieter spruce; right larch withheld to remove the second paired arrangement.','The isolated upper-valley alder is withheld rather than forced into the middle distance.','Only two saplings remain, associated with the left anchor at unequal distances.','No tree assets added, no flowers/grass changed, no terrain, water, hamlet, mountain, camera or lighting edits.']
for o in collection.objects:
    p=world_to_camera_view(scene,camera,o.location)
    projected=[world_to_camera_view(scene,camera,o.matrix_world@Vector(v)) for v in o.bound_box]
    report['after'].append({'name':o.name,'species':o.get('species'),'root':list(o.location),'rotation':list(o.rotation_euler),'scale':o.scale.x,'visible':not o.hide_render and not o.hide_get(),'screen_root':list(p),'screen_bounds':[[min(p[i] for p in projected) for i in range(2)],[max(p[i] for p in projected) for i in range(2)]],'intent':o.get('placement_intent')})
assert snapshot()==baseline,'A protected non-tree object changed.'
report['non_tree_objects_unchanged']=True
report['visible_trees']=sum(x['visible'] for x in report['after'])
report['held_trees']=len(report['after'])-report['visible_trees']
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
saved={'x':scene.render.resolution_x,'y':scene.render.resolution_y,'percent':scene.render.resolution_percentage,'samples':scene.cycles.samples,'device':scene.cycles.device,'path':scene.render.filepath,'denoise':scene.cycles.use_denoising}
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
    for d in prefs.devices:d.use=d.type!='CPU'
    scene.cycles.device='GPU'
except Exception:scene.cycles.device='CPU'
scene.cycles.samples=128;scene.cycles.use_denoising=True;scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100;scene.render.filepath=str(ROOT/'tree_composition_preview.png')
bpy.ops.render.render(write_still=True)
scene.render.resolution_x=saved['x'];scene.render.resolution_y=saved['y'];scene.render.resolution_percentage=saved['percent'];scene.cycles.samples=saved['samples'];scene.cycles.device=saved['device'];scene.cycles.use_denoising=saved['denoise'];scene.render.filepath=saved['path']
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
(ROOT/'tree_composition_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('TREE COMPOSITION RENDERED',json.dumps({'visible_trees':report['visible_trees'],'held_trees':report['held_trees'],'protected_non_tree_objects':len(baseline['objects'])}),flush=True)
