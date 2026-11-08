"""Fresh-file geometric and grounding verification; no scene changes."""
import bpy,numpy as np,json,sys,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
R=Path(__file__).resolve().parent;sys.path.insert(0,str(R))
from terrain_grounding_fields import main_range,buildings_field,LANE,shelf
from habitat_structure_fields import HabitatStructure
bpy.ops.wm.open_mainfile(filepath=str(R/'echelon_alpine_composition_01.blend'));s=bpy.context.scene;c=s.camera;meta=json.loads((R/'grounding_pass_source.json').read_text());src=np.load(R/'grounding_pass_source.npz');report=json.loads((R/'grounding_pass_report.json').read_text());G='Continuous meadow foothills and mountain range';g=bpy.data.objects[G]
def co(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
def original(n):return src[meta['meshes'][n]['key']]
a=co(g);old=original(G);assert np.array_equal(a[:,:2],old[:,:2]);assert np.array_equal(a[old[:,1]<75],old[old[:,1]<75]);assert [list(v) for v in c.matrix_world]==meta['camera'] and c.data.lens==meta['lens'];assert hashlib.sha256(co(bpy.data.objects['Water inside carved channel - static graded surface']).tobytes()).hexdigest()==meta['water_hash']
A=R.parent/'asset-auditions/mountain-foundation';h=np.load(A/'terrain002_height.npy');specs=[r for r in json.loads((A/'foundation_C_report.json').read_text())['summit_transforms'] if r[4]>=45];ids=np.flatnonzero(old[:,1]>185);main=main_range(h,old[ids,0],old[ids,1],specs);protected=ids[main>17];assert np.array_equal(a[protected],old[protected])
sections=np.load(R/'habitat_structure_source.npz');fields=HabitatStructure([sections['sections0'],sections['sections1']]);d,level,*_=fields.bank(old[:,0],old[:,1]);channel=(old[:,1]<=225)&(d<.4);assert np.array_equal(a[channel],old[channel])
# The shelf has a simple continuous grade, with water-stage freeboard near its edge.
interior=(old[:,0]>30)&(old[:,0]<60)&(old[:,1]>105)&(old[:,1]<155);expected=shelf(old[:,0],old[:,1],d,level);shelf_error=float(np.max(abs(a[interior,2]-expected[interior])));assert shelf_error<.0001,shelf_error
clear=buildings_field(LANE[:,0],LANE[:,1],report['buildings']);assert clear.max()<.05,float(clear.max())
# Source terrain for root-embedding comparisons, including its existing modifier.
me=g.data.copy();me.vertices.foreach_set('co',old.ravel());me.update()
for name,v in meta['meshes'][G]['attributes'].items():me.attributes[name].data.foreach_set('value',src[v['key']])
audit=bpy.data.objects.new('Temporary pre-grounding surface',me);s.collection.objects.link(audit)
for mod in g.modifiers:
 if mod.type=='NODES':m=audit.modifiers.new(mod.name,'NODES');m.node_group=mod.node_group
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();before=BVHTree.FromObject(audit,dg);after=BVHTree.FromObject(g,dg);bpy.data.objects.remove(audit,do_unlink=True);bpy.data.meshes.remove(me)
def z(bv,x,y):
 p,*_=bv.ray_cast(Vector((float(x),float(y),350)),Vector((0,0,-1)),900);assert p is not None;return p.z
rootdiff=[];counts={}
for name,block in {'Foreground arching grass':18,'Low basal meadow foliage':18,'Midground meadow continuation':12,'Meadow to foothill transition':12}.items():
 o=bpy.data.objects[name];a0=original(name).reshape((-1,block,3))[:,1,:];a1=co(o).reshape((-1,block,3))[:,1,:];assert np.array_equal(a0[:,:2],a1[:,:2]);counts[name]=len(a1)
 for i in np.linspace(0,len(a1)-1,250,dtype=int):rootdiff.append(float(a1[i,2]-z(after,*a1[i,:2])-a0[i,2]+z(before,*a0[i,:2])))
for name,rec in meta['meshes'].items():
 if not name.startswith('Meadow blooms - '):continue
 o=bpy.data.objects[name];a0=original(name);a1=co(o);assert np.array_equal(a0[:,:2],a1[:,:2]);counts[name]=len(a1)
 for an in ['plant_scale','plant_rotation']:
  value=np.empty((len(a1),3),np.float32);o.data.attributes[an].data.foreach_get('vector',value.ravel());assert np.array_equal(value,src[rec['attributes'][an]['key']])
 for i in range(len(a1)):rootdiff.append(float(a1[i,2]-z(after,*a1[i,:2])-a0[i,2]+z(before,*a0[i,:2])))
assert max(abs(np.array(rootdiff)))<.0001,max(abs(np.array(rootdiff)))
seats=[]
for b,door in zip(report['buildings'],report['doors']):
 error=b['origin'][2]-z(after,*door)-.055;assert abs(error)<.0001,error;seats.append(float(error))
stones=[]
for rec in report['stones']:
 o=bpy.data.objects[rec['name']];points=[o.matrix_world@v.co for v in o.data.vertices];diff=np.array([p.z-z(after,p.x,p.y) for p in points]);assert diff.min()<0<diff.max();fraction=float((diff>0).mean());assert .2<fraction<.46,(o.name,fraction);stones.append({'name':o.name,'vertices_above_soil_fraction':fraction,'above_soil_max_m':float(diff.max()),'below_soil_max_m':float(-diff.min())})
for n in ['Grounded hamlet single lane','Grounded bank stone contact']:assert bpy.data.images[n].packed_file
profiles={str(x):[[y,z(after,x,y)] for y in [185,220,250,268,300,350,400,450,500]] for x in [-150,-75,0,75,150]}
result={'fresh_saved_scene_reopened':True,'camera_preserved':True,'water_geometry_byte_identical':True,'terrain_xy_unchanged':True,'foreground_terrain_y_below75_byte_identical':True,'channel_vertices_byte_identical':int(channel.sum()),'protected_mountain_vertices_byte_identical':len(protected),'shelf_max_formula_error_m':shelf_error,'shelf_grade_x':.035,'shelf_grade_y':.060,'single_lane_center_clear_of_building_footprints':True,'root_embedding_difference_max_m':float(max(abs(np.array(rootdiff)))),'flower_species_scale_rotation_and_xy_preserved':True,'population_counts':counts,'building_seat_max_error_m':max(abs(np.array(seats))),'stone_contact':stones,'both_new_contact_masks_packed':True,'new_long_profiles':profiles}
(R/'grounding_pass_verification.json').write_text(json.dumps(result,indent=2));print('GROUNDING SAVED FILE VERIFIED',json.dumps(result),flush=True)
