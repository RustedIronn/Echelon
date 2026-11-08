"""Reopen the saved countryside/geology pass, verify preservation and render camera crops."""
import bpy,numpy as np,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
R=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(R/'echelon_alpine_composition_01.blend'))
s=bpy.context.scene;c=s.camera;m=json.loads((R/'country_geology_source.json').read_text());src=np.load(R/'country_geology_source.npz')
def coords(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
def original(n):return src[m['meshes'][n]['key']]
G='Continuous meadow foothills and mountain range';W='Water inside carved channel - static graded surface';g=bpy.data.objects[G]
assert [list(v) for v in c.matrix_world]==m['camera']['matrix'] and c.data.lens==m['camera']['lens']
water=coords(bpy.data.objects[W]);water0=original(W);assert np.array_equal(water[:,1:],water0[:,1:]);assert np.max(abs(water[:,0]-water0[:,0]))<.30
assert bpy.data.objects[W].visible_shadow==False
me=g.data.copy();me.vertices.foreach_set('co',original(G).ravel());me.update();audit=bpy.data.objects.new('Temporary previous terrain verification',me);s.collection.objects.link(audit)
for mod in g.modifiers:
 if mod.type=='NODES':n=audit.modifiers.new(mod.name,'NODES');n.node_group=mod.node_group
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();before=BVHTree.FromObject(audit,dg);after=BVHTree.FromObject(g,dg);bpy.data.objects.remove(audit,do_unlink=True);bpy.data.meshes.remove(me)
frame=c.data.view_frame(scene=s);fx0=min(v.x/-v.z for v in frame);fx1=max(v.x/-v.z for v in frame);fy0=min(v.y/-v.z for v in frame);fy1=max(v.y/-v.z for v in frame)
def horizon(bv,u):
 lo=.30;hi=.84
 for k in range(22):
  v=(lo+hi)/2;di=(c.matrix_world.to_3x3()@Vector((fx0+(fx1-fx0)*u,fy0+(fy1-fy0)*v,-1))).normalized();p,*_=bv.ray_cast(c.location,di,1800)
  if p is None:hi=v
  else:lo=v
 return (lo+hi)/2
sky=max(abs(horizon(before,u)-horizon(after,u)) for u in np.linspace(0,1,121))*1080;assert sky<.1,sky
def height(bv,p):
 h,*_=bv.ray_cast(Vector((float(p[0]),float(p[1]),350)),Vector((0,0,-1)),750);assert h is not None;return h.z
roots=[];flowers={};grass={}
for name,block in {'Foreground arching grass':18,'Low basal meadow foliage':18,'Midground meadow continuation':12,'Meadow to foothill transition':12}.items():
 o=bpy.data.objects[name];a=coords(o).reshape((-1,block,3))[:,1,:];b=original(name).reshape((-1,block,3))[:,1,:];assert len(a)==len(b)
 for i in np.linspace(0,len(a)-1,250,dtype=int):roots.append(float(a[i,2]-height(after,a[i])-b[i,2]+height(before,b[i])))
 grass[name]=len(a)
for name in m['meshes']:
 if name.startswith('Meadow blooms - '):
  o=bpy.data.objects[name];a=coords(o);b=original(name);assert len(a)==len(b)
  for i in range(len(a)):roots.append(float(a[i,2]-height(after,a[i])-b[i,2]+height(before,b[i])))
  flowers[name]=len(a)
assert max(abs(np.array(roots)))<.0001,max(abs(np.array(roots)))
for name,rec in m['objects'].items():
 if name.startswith('Village '):assert bpy.data.objects[name].hide_render
 if name in bpy.data.collections['Authored trees and saplings - individual placements'].objects:
  o=bpy.data.objects[name];assert o.hide_render==rec['render_hidden'] and o.hide_get()==rec['hidden'];assert [list(v) for v in o.matrix_world]==rec['matrix']
col=bpy.data.collections['11 Countryside hamlet - vernacular buildings'];assert len(col.children)==5
result={'fresh_file_reopened':True,'fixed_camera_preserved':True,'terrain_horizon_max_change_pixels_at_1080':sky,'water_y_and_z_unchanged':True,'water_max_bank_warp_x_m':float(np.max(abs(water[:,0]-water0[:,0]))),'root_embedding_difference_max_m':float(max(abs(np.array(roots)))),'grass_blade_counts_retained':grass,'flower_source_point_counts_retained':flowers,'previous_architecture_hidden':True,'new_building_collections':5,'new_editable_building_parts':len(col.all_objects),'background_tree_visibility_and_poses_preserved':True}
(R/'country_geology_verification.json').write_text(json.dumps(result,indent=2));print('COUNTRY SAVED FILE VERIFIED',json.dumps(result),flush=True)
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=128;s.cycles.use_denoising=True;s.render.resolution_x=3840;s.render.resolution_y=2160;s.render.resolution_percentage=100;s.render.use_border=True;s.render.use_crop_to_border=True
for filename,bounds in [('country_hamlet_detail.png',(.63,.84,.34,.555)),('country_mountain_detail.png',(.17,.88,.51,.70)),('country_bank_detail.png',(.44,.94,.24,.39))]:
 s.render.border_min_x,s.render.border_max_x,s.render.border_min_y,s.render.border_max_y=bounds;s.render.filepath=str(R/filename);bpy.ops.render.render(write_still=True)
print('COUNTRY CAMERA CROPS COMPLETE',flush=True)
