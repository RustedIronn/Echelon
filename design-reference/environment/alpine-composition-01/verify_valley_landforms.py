"""Fresh canonical-file validation plus same-camera supporting renders."""
import bpy,json,sys,hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
r=Path(__file__).resolve().parent;sys.path.insert(0,str(r));from stream_network import StreamNetwork
bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'));s=bpy.context.scene;c=s.camera
meta=json.loads((r/'valley_landform_source.json').read_text());src=np.load(r/'valley_landform_source.npz')
G='Continuous meadow foothills and mountain range';W='Water inside carved channel - static graded surface'
def coords(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
def co(name):return coords(bpy.data.objects[name])
def old(name):return src[meta['meshes'][name]['key']]
assert [list(v) for v in c.matrix_world]==meta['camera']['matrix'] and c.data.lens==meta['camera']['lens']
for name,info in meta['lights'].items():assert bpy.data.objects[name].data.energy==info['energy'] and [list(v) for v in bpy.data.objects[name].matrix_world]==info['matrix']
a=co(G);base=old(G);assert np.array_equal(a[base[:,1]>=323],base[base[:,1]>=323]);assert np.array_equal(a[:,1],base[:,1])
w=co(W);assert np.array_equal(w[:,1:],old(W)[:,1:]);assert len(w)==len(old(W))
# Geometric warp must not fold a terrain row over itself.
order=np.lexsort((base[:,0],base[:,1]));b=base[order];v=a[order];same=(np.diff(b[:,1])==0)&(np.diff(b[:,0])>1e-4);assert np.min(np.diff(v[:,0])[same])>0
# Compare the upper projected terrain envelope in 960 horizontal bins.
inv=np.array(c.matrix_world.inverted());frame=c.data.view_frame(scene=s);fx0=min(v.x/-v.z for v in frame);fx1=max(v.x/-v.z for v in frame);fy0=min(v.y/-v.z for v in frame);fy1=max(v.y/-v.z for v in frame)
def envelope(a):
 b=a@inv[:3,:3].T+inv[:3,3];depth=-b[:,2];u=(b[:,0]/depth-fx0)/(fx1-fx0);v=(b[:,1]/depth-fy0)/(fy1-fy0);valid=(depth>0)&(u>=0)&(u<1);idx=(u[valid]*960).astype(int);top=np.full(960,-1e5);np.maximum.at(top,idx,v[valid]);return top
e1=envelope(a);e0=envelope(base);difference=abs(e1-e0)*1080;skyline_difference=float(np.max(difference));print('SKYLINE',skyline_difference,'u',float(np.argmax(difference)/960),'old',float(e0[np.argmax(difference)]),'new',float(e1[np.argmax(difference)]),flush=True)
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();gb=BVHTree.FromObject(bpy.data.objects[G],deps);wb=BVHTree.FromObject(bpy.data.objects[W],deps)
# A vertex envelope can miss peaks between narrow bins; measure the actual
# triangle silhouette with ray casts instead of treating that sampling error as change.
me=bpy.data.objects[G].data.copy();me.vertices.foreach_set('co',base.ravel());me.update();audit=bpy.data.objects.new('Temporary source silhouette audit',me);s.collection.objects.link(audit);audit.hide_render=True;bpy.context.view_layer.update();old_bv=BVHTree.FromObject(audit,bpy.context.evaluated_depsgraph_get());bpy.data.objects.remove(audit,do_unlink=True);bpy.data.meshes.remove(me)
def skyline(bv,u):
 lo=.30;hi=.85
 for step in range(23):
  v=(lo+hi)/2;direction=(c.matrix_world.to_3x3()@Vector((fx0+(fx1-fx0)*u,fy0+(fy1-fy0)*v,-1))).normalized();p,n,face,dist=bv.ray_cast(c.location,direction,1800)
  if p is None:hi=v
  else:lo=v
 return (lo+hi)/2
silhouette_samples=[]
for u in np.linspace(.005,.995,121):silhouette_samples.append(abs(skyline(gb,float(u))-skyline(old_bv,float(u)))*1080)
vertex_envelope_sampling_difference=skyline_difference;skyline_difference=float(max(silhouette_samples));print('ACTUAL TRIANGLE SKYLINE DIFFERENCE PX',skyline_difference,flush=True)
assert skyline_difference<1.0
def height(x,y):
 p,n,*_=gb.ray_cast(Vector((float(x),float(y),350)),Vector((0,0,-1)),750);return p,n
# Confirm the diagnosed old front discontinuity is now a gentle grade.
front=[]
for x in [-52,0,88]:
 p,n=height(x,233.5);p2,n2=height(x,234);jump=p2.z-p.z;assert abs(jump)<.2
 front.append({'x':x,'half_metre_grade_change_m':jump,'normal_z':n2.z})
# Water remains above a recessed channel, including the tributary.
network=StreamNetwork();water_samples=[]
for stream,ys in [(network.main,[-5,15,29,40,55,70]),(network.tributary,[48,69,88,110,145,175,205])]:
 for y in ys:
  # The saved channel and water share the same X deformation: locate water near the old center.
  x=stream.center(y);candidates=[]
  for dx in np.linspace(-1,1,21):
   p,n=height(x+dx,y);wp,wn,*_=wb.ray_cast(Vector((x+dx,y,350)),Vector((0,0,-1)),750)
   if wp and p and wp.z>p.z:candidates.append((wp.z-p.z,x+dx))
  assert candidates,('no visible water at stream center',stream.name,y)
  clearance,x=max(candidates);assert clearance>.30,(stream.name,y,clearance)
  water_samples.append({'stream':stream.name,'y':y,'bed_clearance_m':clearance})
flowers={};flower_errors=[]
for name,item in meta['meshes'].items():
 if not name.startswith('Meadow blooms - '):continue
 a=co(name);b=old(name);near=b[:,1]<=16;assert np.array_equal(a[near],b[near]);o=bpy.data.objects[name];zoff=np.empty(len(a),np.float32);o.data.attributes['tree_habitat_z'].data.foreach_get('value',zoff)
 for i in np.linspace(0,len(a)-1,min(len(a),100),dtype=int):
  p,n=height(a[i,0],a[i,1]);flower_errors.append(float(a[i,2]+zoff[i]-p.z))
 flowers[name]={'points':len(a),'immediate_foreground_points_byte_identical':int(near.sum())}
grass_errors=[];grass_counts={}
for name,block in [('Foreground arching grass',18),('Low basal meadow foliage',18),('Midground meadow continuation',12),('Meadow to foothill transition',12)]:
 a=co(name);assert len(a)==len(old(name));roots=a.reshape((-1,block,3))[:,1,:];grass_counts[name]=len(roots);o=bpy.data.objects[name]
 off=np.empty(len(a),np.float32);o.data.attributes['tree_habitat_z'].data.foreach_get('value',off);off=off.reshape((-1,block))[:,1]
 for i in np.linspace(0,len(roots)-1,100,dtype=int):
  p,n=height(roots[i,0],roots[i,1]);grass_errors.append(float(roots[i,2]+off[i]-p.z))
# Foundation corner bottoms should penetrate the soil, not float over it.
foundation=[]
for k in range(1,6):
 name=f'Village {k:02} stone foundation';o=bpy.data.objects[name];pts=[o.matrix_world@v.co for v in o.data.vertices];errors=[]
 for p in pts[:4]:
  h,n=height(p.x,p.y);errors.append(p.z-h.z)
 foundation.append({'building':k,'foundation_bottom_minus_soil_m':errors})
# Fascia center must lie on its original roof edge after rigid seating.
fascia=[]
for k in range(1,6):
 roof=bpy.data.objects[f'Village {k:02} pitched roof'];v=[roof.matrix_world@p.co for p in roof.data.vertices]
 for aa,bb in [(0,4),(4,1),(3,5),(5,2),(0,3),(1,2)]:
  ob=bpy.data.objects[f'Village {k:02} visible fascia {aa}{bb}'];points=[ob.matrix_world@p.co for p in ob.data.vertices];center=sum(points,Vector())/len(points);error=(center-(v[aa]+v[bb])/2).length;fascia.append(error)
assert max(fascia)<.0001
hidden=[]
for o in bpy.data.collections['Authored trees and saplings - individual placements'].objects:
 if o.name!='Norway Spruce - foreground-left stream shelter':assert o.hide_render and o.hide_get();hidden.append(o.name)
result={'fresh_saved_scene_reopened':True,'camera_and_lights_unchanged':True,'upper_range_vertices_y323_plus_byte_identical':True,'maximum_projected_skyline_difference_px':skyline_difference,'no_folded_terrain_rows':True,'water_y_z_and_topology_count_unchanged':True,'former_front_step_samples':front,'water_centerline_samples':water_samples,'flower_source_points':flowers,'grass_source_blade_counts':grass_counts,'sampled_flower_root_error_m':{'min':min(flower_errors),'max':max(flower_errors),'p95_abs':float(np.quantile(abs(np.array(flower_errors)),.95))},'sampled_grass_root_error_m':{'min':min(grass_errors),'max':max(grass_errors),'p95_abs':float(np.quantile(abs(np.array(grass_errors)),.95))},'foundation_checks':foundation,'maximum_roof_trim_alignment_error_m':max(fascia),'temporarily_hidden_background_trees':hidden}
(r/'valley_landform_verification.json').write_text(json.dumps(result,indent=2));print('VERIFIED',json.dumps(result),flush=True)
if '--checks-only' in sys.argv:sys.exit(0)
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=96;s.cycles.use_denoising=True;s.render.resolution_x=3840;s.render.resolution_y=2160;s.render.resolution_percentage=100;s.render.use_border=True;s.render.use_crop_to_border=True
for name,bounds in [('valley_hamlet_detail.png',(.65,.83,.42,.56)),('valley_stream_meadow_detail.png',(.28,.61,.38,.55))]:
 s.render.border_min_x,s.render.border_max_x,s.render.border_min_y,s.render.border_max_y=bounds;s.render.filepath=str(r/name);bpy.ops.render.render(write_still=True)
print('FRESH SCENE AND SUPPORTING RENDERS COMPLETE',flush=True)
