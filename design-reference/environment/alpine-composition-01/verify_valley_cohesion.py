"""Reopen saved cohesion scene, check preservation/grounding and render details."""
import bpy,numpy as np,json,sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parent;sys.path.insert(0,str(ROOT))
from stream_network import StreamNetwork
from cohesion_fields import CohesionFields
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'echelon_alpine_composition_01.blend'));s=bpy.context.scene;c=s.camera
meta=json.loads((ROOT/'cohesion_source.json').read_text());src=np.load(ROOT/'cohesion_source.npz');fields=CohesionFields(src['tributary_sections'],meta['paths'])
G='Continuous meadow foothills and mountain range';W='Water inside carved channel - static graded surface'
def co(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
def original(name):return src[meta['meshes'][name]['key']]
assert set(o.name for o in s.objects)==set(meta['objects'])
for name,rec in meta['objects'].items():
 o=bpy.data.objects[name];assert [list(v) for v in o.matrix_world]==rec['matrix'],('pose changed',name);assert o.hide_render==rec['hide_render'] and o.hide_get()==rec['hide'],('visibility',name)
assert [list(v) for v in c.matrix_world]==meta['camera']['matrix'] and c.data.lens==meta['camera']['lens']
for name,energy in meta['lights'].items():assert bpy.data.objects[name].data.energy==energy
terrain=co(bpy.data.objects[G]);ground0=original(G);assert np.array_equal(terrain[ground0[:,1]>250],ground0[ground0[:,1]>250]);assert np.array_equal(terrain[ground0[:,1]<35],ground0[ground0[:,1]<35])
water=co(bpy.data.objects[W]);water0=original(W);assert np.array_equal(water[:,1:],water0[:,1:]);network=StreamNetwork()
y=water0[:,1];ygrid=np.arange(-40,226,.25);mc=np.interp(y,ygrid,[network.main.center(v) for v in ygrid]);tc=np.interp(y,ygrid,[network.tributary.center(v) for v in ygrid]);main=(y<=104)&((abs(water0[:,0]-mc)<abs(water0[:,0]-tc))|(y<44));assert np.array_equal(water[main],water0[main])
# Saved field must remain a closed water volume after the shared deformation.
loops=np.empty(len(bpy.data.objects[W].data.loops),np.int32);bpy.data.objects[W].data.loops.foreach_get('edge_index',loops);edge_users=np.bincount(loops,minlength=len(bpy.data.objects[W].data.edges));assert np.all(edge_users==2)
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();gb=BVHTree.FromObject(bpy.data.objects[G],deps);wb=BVHTree.FromObject(bpy.data.objects[W],deps)
def height(x,y):
 p,n,*_=gb.ray_cast(Vector((float(x),float(y),350)),Vector((0,0,-1)),750);return p,n
sections=src['tributary_sections'];samples=[]
for y in [50,60,73,85,100,112,132,158,180,205]:
 center=np.interp(y,sections[:,0],sections[:,1]);center+=float(fields.warp(np.array([center]),np.array([y]))[0]);p,n=height(center,y);wp,*_=wb.ray_cast(Vector((center,y,350)),Vector((0,0,-1)),750);assert wp is not None and wp.z-p.z>.25,(y,wp.z-p.z if wp else None);samples.append({'y':y,'channel_water_depth_m':wp.z-p.z})
flower_stats={};root_errors=[];relocated_visible=0
for name,rec in meta['meshes'].items():
 if not name.startswith('Meadow blooms - '):continue
 o=bpy.data.objects[name];a=co(o);old=original(name);near=old[:,1]<35;assert len(a)==len(old) and np.array_equal(a[near],old[near])
 for at in ['plant_scale','plant_rotation']:
  values=np.empty((len(a),3),np.float32);o.data.attributes[at].data.foreach_get('vector',values.ravel());before=src[rec['attributes'][at]['key']];assert np.array_equal(values[near],before[near]),(name,at)
 moved=np.linalg.norm(a[:,:2]-old[:,:2],axis=1)>2.0
 for i in np.flatnonzero(moved):
  q=world_to_camera_view(s,c,Vector(a[i]));assert .045<q.x<.96 and .39<q.y<.54,(name,i,list(q));relocated_visible+=1
 off=np.empty(len(a),np.float32);o.data.attributes['tree_habitat_z'].data.foreach_get('value',off)
 for i in np.linspace(0,len(a)-1,min(len(a),100),dtype=int):
  p,n=height(a[i,0],a[i,1]);root_errors.append(a[i,2]+off[i]-p.z)
 flower_stats[name]={'source_points':len(a),'preserved_foreground_points':int(near.sum()),'relocated_into_camera_meadow':int(moved.sum())}
assert relocated_visible==135
report={'fresh_scene_reopened':True,'object_count_unchanged':len(s.objects),'all_object_poses_and_visibility_unchanged':True,'camera_lights_unchanged':True,'upper_geography_y250_plus_unchanged':True,'main_stream_vertices_unchanged':int(main.sum()),'water_y_z_unchanged_and_mesh_closed':True,'tributary_water_depth_samples':samples,'flower_checks':flower_stats,'flower_root_error_m':{'minimum':float(min(root_errors)),'maximum':float(max(root_errors)),'p95_absolute':float(np.quantile(abs(np.array(root_errors)),.95))},'ground_wear_mask_packed':bool(bpy.data.images['Echelon hamlet - editable ground wear mask'].packed_file)}
(ROOT/'cohesion_verification.json').write_text(json.dumps(report,indent=2));print('COHESION SAVED-FILE VERIFIED',json.dumps(report),flush=True)
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=96;s.cycles.use_denoising=True;s.render.resolution_x=3840;s.render.resolution_y=2160;s.render.resolution_percentage=100;s.render.use_border=True;s.render.use_crop_to_border=True
for filename,bounds in [('cohesion_hamlet_detail.png',(.65,.83,.415,.56)),('cohesion_tributary_detail.png',(.28,.61,.38,.55))]:
 s.render.border_min_x,s.render.border_max_x,s.render.border_min_y,s.render.border_max_y=bounds;s.render.filepath=str(ROOT/filename);bpy.ops.render.render(write_still=True)
print('FINAL DETAIL RENDERS COMPLETE',flush=True)
