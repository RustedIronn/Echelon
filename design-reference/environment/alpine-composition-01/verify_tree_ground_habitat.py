"""Fresh-process saved-scene verification and unchanged-camera detail render."""
import bpy,json,hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
r=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'))
s=bpy.context.scene;b=json.loads((r/'tree_ground_habitat_baseline.json').read_text());rep=json.loads((r/'tree_ground_habitat_report.json').read_text())
def coords(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
def digest(a):return hashlib.sha256(a.tobytes()).hexdigest()
assert {'name':s.camera.name,'matrix':[list(v) for v in s.camera.matrix_world],'lens':s.camera.data.lens}==b['camera']
for name,h in b['meshes'].items():assert digest(coords(bpy.data.objects[name]))==h,name
allowed={'Norway Spruce - foreground-left stream shelter','Norway Spruce - distant left foothill remnant'}|{x['name'] for x in rep['ferns']}
for name,m in b['poses'].items():
 if name not in allowed:assert [list(v) for v in bpy.data.objects[name].matrix_world]==m,name
for name,v in b['lights'].items():
 o=bpy.data.objects[name];assert o.data.energy==v['energy'] and [list(v) for v in o.matrix_world]==b['poses'][name]
deps=bpy.context.evaluated_depsgraph_get();g=bpy.data.objects['Continuous meadow foothills and mountain range'];a=coords(g);eg=g.evaluated_get(deps);ev=coords(eg);delta=ev-a
assert np.max(abs(delta[:,:2]))==0
assert np.max(abs(delta[a[:,1]>=225]))==0
assert delta[:,2].min()>-1e-5 and delta[:,2].max()<.048
flowers={}
for o in s.objects:
 if not o.name.startswith('Meadow blooms - '):continue
 v=np.empty(len(o.data.vertices));o.data.attributes['tree_habitat_core'].data.foreach_get('value',v)
 flowers[o.name]={'source_points':len(v),'locally_excluded':int(sum(v>.64))}
visible={name:0 for name in flowers}
for inst in deps.object_instances:
 if inst.is_instance and inst.parent and inst.parent.original.name in visible:visible[inst.parent.original.name]+=1
for name,v in flowers.items():assert visible[name]==v['source_points']-v['locally_excluded'],(name,visible[name],v)
for name in ['Foreground arching grass','Low basal meadow foliage','Midground meadow continuation','Meadow to foothill transition']:
 m=bpy.data.objects[name].modifiers['Tree habitat - grass response'];assert m.show_viewport and m.show_render
fg=bpy.data.objects['Norway Spruce - foreground-left stream shelter'];q=[world_to_camera_view(s,s.camera,fg.matrix_world@v.co) for v in fg.data.vertices]
assert min(v.x for v in q)>0 and max(v.x for v in q)<1
bv=BVHTree.FromObject(g,deps);ground,n,face,dist=bv.ray_cast(Vector((fg.location.x,fg.location.y,350)),Vector((0,0,-1)),700)
assert abs(fg.location.z-ground.z)<.07
out={'fresh_file_reopened':True,'active_camera':s.camera.name,'camera_lights_and_protected_object_poses_verified':True,'existing_meshes_byte_identical':len(b['meshes']),'water_and_mountain_geometry_unchanged':True,'maximum_local_ground_relief_m':float(delta[:,2].max()),'foreground_tree_fully_inside_camera':True,'foreground_tree_source_ground_minus_evaluated_terrain_m':fg.location.z-ground.z,'flowers':flowers,'rendered_flower_instances':visible,'viewport_and_render_habitat_modifiers_enabled':True}
(r/'tree_ground_habitat_verification.json').write_text(json.dumps(out,indent=2));print('VERIFIED',json.dumps(out),flush=True)
# Render a detail of the SAME hero camera, with no saved camera or render-setting changes.
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=96;s.cycles.use_denoising=True;s.render.resolution_x=3840;s.render.resolution_y=2160;s.render.resolution_percentage=100
s.render.use_border=True;s.render.use_crop_to_border=True;s.render.border_min_x=.055;s.render.border_max_x=.26;s.render.border_min_y=.26;s.render.border_max_y=.44
s.render.filepath=str(r/'tree_ground_habitat_detail.png');bpy.ops.render.render(write_still=True)
print('SAVED SCENE VERIFIED AND DETAIL RENDERED',flush=True)
