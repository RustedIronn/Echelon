"""Fresh saved-file validation and hero-camera detail renders."""
import bpy,numpy as np,json,sys,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(ROOT/'echelon_alpine_composition_01.blend'));s=bpy.context.scene;c=s.camera
meta=json.loads((ROOT/'habitat_structure_source.json').read_text());src=np.load(ROOT/'habitat_structure_source.npz');report=json.loads((ROOT/'habitat_structure_report.json').read_text())
G='Continuous meadow foothills and mountain range';W='Water inside carved channel - static graded surface'
GRASSES={'Foreground arching grass':18,'Low basal meadow foliage':18,'Midground meadow continuation':12,'Meadow to foothill transition':12}
def co(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
def original(name):return src[meta['meshes'][name]['key']]
assert [list(v) for v in c.matrix_world]==meta['camera']['matrix'] and c.data.lens==meta['camera']['lens']
for name,rec in meta['objects'].items():
 o=bpy.data.objects[name]
 if not name.startswith('Bank limestone '):assert [list(v) for v in o.matrix_world]==rec['matrix'],('original pose changed',name)
 else:assert abs(o.location.x-rec['matrix'][0][3])<1e-5 and abs(o.location.y-rec['matrix'][1][3])<1e-5
 assert o.hide_get()==rec['hidden'] and o.hide_render==rec['render_hidden'],('visibility changed',name)
g=bpy.data.objects[G];a=co(g);old=original(G);assert np.array_equal(a[:,:2],old[:,:2]);assert np.array_equal(a[old[:,1]>250],old[old[:,1]>250]);assert np.array_equal(co(bpy.data.objects[W]),original(W))
assert bpy.data.objects[W].visible_shadow is False and bpy.data.objects[W].visible_transmission and bpy.data.objects[W].visible_glossy
# Original surface for exact comparison of retained root embedding.
me=g.data.copy();me.vertices.foreach_set('co',old.ravel());me.update();audit=bpy.data.objects.new('Temporary source-root audit',me);s.collection.objects.link(audit);audit.hide_render=True
for m in g.modifiers:
 if m.type=='NODES':m2=audit.modifiers.new(m.name,'NODES');m2.node_group=m.node_group
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();before=BVHTree.FromObject(audit,deps);after=BVHTree.FromObject(g,deps);bpy.data.objects.remove(audit,do_unlink=True);bpy.data.meshes.remove(me)
def height(bv,x,y):
 p,n,*_=bv.ray_cast(Vector((float(x),float(y),350)),Vector((0,0,-1)),750);assert p is not None;return p.z
root_differences=[];root_errors=[];flowers={};grass={}
for name,block in GRASSES.items():
 o=bpy.data.objects[name];a=co(o).reshape((-1,block,3))[:,1,:];b=original(name).reshape((-1,block,3))[:,1,:];assert len(co(o))==len(original(name))
 follow=np.empty(len(o.data.vertices),np.float32);o.data.attributes['tree_habitat_z'].data.foreach_get('value',follow);follow=follow.reshape((-1,block))[:,1]
 for i in np.linspace(0,len(a)-1,250,dtype=int):
  er=a[i,2]+follow[i]-height(after,a[i,0],a[i,1]);er0=b[i,2]+follow[i]-height(before,b[i,0],b[i,1]);root_differences.append(float(er-er0));root_errors.append(float(er))
 grass[name]={'retained_blades':len(a)}
for name,rec in meta['meshes'].items():
 if not name.startswith('Meadow blooms - '):continue
 o=bpy.data.objects[name];a=co(o);b=original(name);assert np.array_equal(a[:,:2],b[:,:2]);follow=np.empty(len(a),np.float32);o.data.attributes['tree_habitat_z'].data.foreach_get('value',follow)
 for i in range(len(a)):
  er=a[i,2]+follow[i]-height(after,a[i,0],a[i,1]);er0=b[i,2]+follow[i]-height(before,b[i,0],b[i,1]);root_differences.append(float(er-er0));root_errors.append(float(er))
 flowers[name]={'retained_source_points':len(a),'unchanged_xy':True}
assert max(abs(np.array(root_differences)))<.0001,max(abs(np.array(root_differences)))
# Verify retained botanical scales/rotations against the preceding authored pass.
co_meta=json.loads((ROOT/'cohesion_source.json').read_text());co_src=np.load(ROOT/'cohesion_source.npz');sys.path.insert(0,str(ROOT));from cohesion_fields import communities
for name in flowers:
 o=bpy.data.objects[name];record=co_meta['meshes'][name];base=co_src[record['key']];mesic,quiet,middle=communities(base[:,0],base[:,1]);enhance=.16 if 'Clover' in name else (.09 if 'Marguerite' in name else .04)
 actual=np.empty((len(base),3),np.float32);o.data.attributes['plant_scale'].data.foreach_get('vector',actual.ravel());expected=co_src[record['attributes']['plant_scale']['key']]*np.maximum(.92,1+enhance*mesic-.04*quiet)[:,None];assert np.allclose(actual,expected,rtol=0,atol=1e-6)
 o.data.attributes['plant_rotation'].data.foreach_get('vector',actual.ravel());assert np.array_equal(actual,co_src[record['attributes']['plant_rotation']['key']])
# Pebble geometry is instanced, not hundreds of independent new scene objects.
emitter=bpy.data.objects['Fluvial pebbles - three restrained sediment pockets'];count=0
for inst in bpy.context.evaluated_depsgraph_get().object_instances:
 if inst.is_instance and inst.parent and inst.parent.original.name==emitter.name:count+=1
assert count==len(emitter.data.vertices)==report['stones']['small_pebble_instances'],(count,len(emitter.data.vertices))
embedding=[]
for o in bpy.data.collections['10 Stream habitat - reusable limestone'].objects:
 if o.name.startswith(('SOURCE','Fluvial')):continue
 points=[o.matrix_world@v.co for v in o.data.vertices];ground=height(after,o.location.x,o.location.y);low=min(p.z for p in points);high=max(p.z for p in points);assert low<ground<high,(o.name,low,ground,high);embedding.append({'name':o.name,'below_soil_m':ground-low,'above_soil_m':high-ground})
result={'fresh_saved_scene_reopened':True,'camera_unchanged':True,'all_original_background_visibility_preserved':True,'all_original_building_and_tree_poses_preserved':True,'range_geometry_y250_plus_byte_identical':True,'water_geometry_byte_identical':True,'existing_grass_blade_counts':grass,'flower_palette_xy_scale_rotation_preserved':flowers,'root_embedding_difference_max_m':float(max(abs(np.array(root_differences)))),'sampled_root_error_m':{'minimum':min(root_errors),'maximum':max(root_errors),'p95_absolute':float(np.quantile(abs(np.array(root_errors)),.95))},'actual_evaluated_pebble_instances':count,'embedded_anchor_checks':embedding,'look':s.view_settings.look,'sun_angle_degrees':float(np.degrees(bpy.data.objects['Simple afternoon sun'].data.angle)),'shallow_water_shadow_approximation_enabled':not bpy.data.objects[W].visible_shadow}
(ROOT/'habitat_structure_verification.json').write_text(json.dumps(result,indent=2));print('STRUCTURE SAVED FILE VERIFIED',json.dumps(result),flush=True)
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=128;s.cycles.use_denoising=True;s.render.resolution_x=3840;s.render.resolution_y=2160;s.render.resolution_percentage=100;s.render.use_border=True;s.render.use_crop_to_border=True
for filename,bounds in [('structure_foreground_detail.png',(.02,.55,.05,.38)),('structure_water_detail.png',(.70,.995,.01,.30))]:
 s.render.border_min_x,s.render.border_max_x,s.render.border_min_y,s.render.border_max_y=bounds;s.render.filepath=str(ROOT/filename);bpy.ops.render.render(write_still=True)
print('STRUCTURE DETAIL RENDERS COMPLETE',flush=True)
