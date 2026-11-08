"""Fresh saved-scene checks and final reference-comparison crops."""
import bpy,numpy as np,json,sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
R=Path(__file__).resolve().parent;sys.path.insert(0,str(R));bpy.ops.wm.open_mainfile(filepath=str(R/'echelon_alpine_composition_01.blend'));s=bpy.context.scene;c=s.camera;meta=json.loads((R/'alpine_identity_source.json').read_text());base=np.load(R/'alpine_identity_source.npz')
def coords(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
g=bpy.data.objects['Continuous meadow foothills and mountain range'];a=coords(g);old=base['xyz'];assert np.array_equal(a[:,:2],old[:,:2]);assert np.array_equal(a[old[:,1]<268],old[old[:,1]<268]);assert [list(v) for v in c.matrix_world]==meta['camera'] and c.data.lens==meta['lens'];assert bpy.data.objects['Simple afternoon sun'].data.energy==meta['sun']
# Compare water against the preceding pass's exact shared bank deformation.
from habitat_structure_fields import HabitatStructure,noise2,smooth
cs=np.load(R/'country_geology_source.npz');cm=json.loads((R/'country_geology_source.json').read_text());sections=np.load(R/'habitat_structure_source.npz');fields=HabitatStructure([sections['sections0'],sections['sections1']]);w=bpy.data.objects['Water inside carved channel - static graded surface'];wa=coords(w);expected=cs[cm['meshes'][w.name]['key']].copy();x,y=expected[:,:2].T;distance,level,side,which=fields.bank(x,y);shift=((noise2(y,side*5,3.8,17)-.5)*.46+(noise2(y,side*3,1.9,32)-.5)*.10)*np.exp(-(np.abs(distance)/3.5)**4)*smooth((y+8)/7)*(1-smooth((y-165)/35));expected[:,0]+=shift.astype(np.float32);assert np.array_equal(wa,expected),'water changed'
# Actual old/new terrain horizons rather than vertex-bin approximations.
me=g.data.copy();me.vertices.foreach_set('co',old.ravel());me.update();audit=bpy.data.objects.new('Temporary identity verification',me);s.collection.objects.link(audit)
for mod in g.modifiers:
 if mod.type=='NODES':m=audit.modifiers.new(mod.name,'NODES');m.node_group=mod.node_group
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();before=BVHTree.FromObject(audit,dg);after=BVHTree.FromObject(g,dg);bpy.data.objects.remove(audit,do_unlink=True);bpy.data.meshes.remove(me)
f=c.data.view_frame(scene=s);x0=min(v.x/-v.z for v in f);x1=max(v.x/-v.z for v in f);y0=min(v.y/-v.z for v in f);y1=max(v.y/-v.z for v in f)
def horizon(bv,u):
 lo=.30;hi=.84
 for k in range(22):
  v=(lo+hi)/2;di=(c.matrix_world.to_3x3()@Vector((x0+(x1-x0)*u,y0+(y1-y0)*v,-1))).normalized();p,*_=bv.ray_cast(c.location,di,1800)
  if p is None:hi=v
  else:lo=v
 return (lo+hi)/2
sky=max(abs(horizon(before,u)-horizon(after,u)) for u in np.linspace(0,1,151))*1080;assert sky<3,sky
flowers={};grass={}
for name,block in {'Foreground arching grass':18,'Low basal meadow foliage':18,'Midground meadow continuation':12,'Meadow to foothill transition':12}.items():
 o=bpy.data.objects[name];grass[name]=len(o.data.vertices)//block;assert len(o.data.vertices)==len(cs[cm['meshes'][name]['key']])
for name in cm['meshes']:
 if name.startswith('Meadow blooms - '):flowers[name]=len(bpy.data.objects[name].data.vertices)
col=bpy.data.collections['11 Countryside hamlet - vernacular buildings'];assert len(col.children)==5
for ch in col.children:
 for o in ch.objects:assert not o.hide_render and not o.hide_get()
spaces=[a.spaces.active.region_3d.view_perspective for screen in bpy.data.screens for a in screen.areas if a.type=='VIEW_3D'];assert spaces and all(v=='CAMERA' for v in spaces)
report={'fresh_file_reopened':True,'fixed_camera_and_lens_preserved':True,'terrain_below_y268_byte_identical':True,'water_geometry_byte_identical':True,'sun_energy_preserved':True,'terrain_horizon_max_difference_pixels_at_1080':sky,'grass_blade_counts':grass,'flower_source_counts':flowers,'new_building_parts':len(col.all_objects),'saved_3d_views':spaces,'packed_lane_mask':bool(bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks'].nodes['Cohesion foot traffic'].image.packed_file)}
(R/'alpine_identity_verification.json').write_text(json.dumps(report,indent=2));print('IDENTITY FRESH FILE VERIFIED',json.dumps(report),flush=True)
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=160;s.cycles.use_denoising=True;s.render.resolution_x=3840;s.render.resolution_y=2160;s.render.resolution_percentage=100;s.render.use_border=True;s.render.use_crop_to_border=True
for filename,bounds in [('alpine_identity_mountains.png',(.15,.92,.50,.70)),('alpine_identity_hamlet.png',(.63,.90,.36,.56)),('alpine_identity_bank.png',(.48,.95,.24,.39))]:
 s.render.border_min_x,s.render.border_max_x,s.render.border_min_y,s.render.border_max_y=bounds;s.render.filepath=str(R/filename);bpy.ops.render.render(write_still=True)
print('IDENTITY FINAL CROPS COMPLETE',flush=True)
