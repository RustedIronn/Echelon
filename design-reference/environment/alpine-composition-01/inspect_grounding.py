"""Inspect the existing shelf, background profiles and stone contact before editing."""
import bpy,numpy as np,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
R=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(R/'echelon_alpine_composition_01.blend'));s=bpy.context.scene;g=bpy.data.objects['Continuous meadow foothills and mountain range'];bpy.context.view_layer.update();bv=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get())
def z(x,y):
 p,*_=bv.ray_cast(Vector((x,y,350)),Vector((0,0,-1)),800);return p.z if p else None
out={'village_grid':{str(y):[z(x,y) for x in [10,20,30,40,50,60,70]] for y in [75,90,105,115,125,135,145,160,180]},'long_profiles':{str(x):[[y,z(x,y)] for y in [180,220,250,268,300,350,400,450,500,550]] for x in [-150,-75,0,75,150]},'buildings':[],'rocks':[],'grass':[]}
for col in bpy.data.collections['11 Countryside hamlet - vernacular buildings'].children:
 points=[o.matrix_world@v.co for o in col.objects for v in o.data.vertices];out['buildings'].append({'collection':col.name,'bounds':[list(map(min,zip(*points))),list(map(max,zip(*points)))],'objects':[o.name for o in col.objects]})
for o in s.objects:
 if o.type=='MESH' and (o.name.startswith(('Embedded limestone anchor','Bank limestone','Low meadow limestone'))):
  if o.hide_render:continue
  points=[o.matrix_world@v.co for v in o.data.vertices];contact=[p.z-z(p.x,p.y) for p in points];out['rocks'].append({'name':o.name,'location':list(o.location),'scale':list(o.scale),'matrix':[list(row) for row in o.matrix_world],'minmax_contact_m':[min(contact),max(contact)],'vertices_above_ground_fraction':sum(c>0 for c in contact)/len(contact),'world_bounds':[list(map(min,zip(*points))),list(map(max,zip(*points)))]})
for name,block in {'Foreground arching grass':18,'Low basal meadow foliage':18,'Midground meadow continuation':12,'Meadow to foothill transition':12}.items():
 o=bpy.data.objects[name];a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());root=a.reshape((-1,block,3))[:,1,:];out['grass'].append({'name':name,'roots':len(root),'village_roots':int(((root[:,0]>15)&(root[:,0]<70)&(root[:,1]>85)&(root[:,1]<175)).sum()),'attributes':[(at.name,at.domain,at.data_type) for at in o.data.attributes]})
em=bpy.data.objects['Fluvial pebbles - three restrained sediment pockets'];out['pebbles']={'count':len(em.data.vertices),'attributes':[(at.name,at.domain,at.data_type) for at in em.data.attributes]};out['terrain_modifiers']=[{'name':m.name,'type':m.type} for m in g.modifiers];out['water_bounds']=[list(map(min,zip(*[v.co for v in bpy.data.objects['Water inside carved channel - static graded surface'].data.vertices]))),list(map(max,zip(*[v.co for v in bpy.data.objects['Water inside carved channel - static graded surface'].data.vertices])))]
(R/'grounding_diagnosis.json').write_text(json.dumps(out,indent=2));print('VILLAGE HEIGHT GRID',out['village_grid'],flush=True);print('PROFILES',out['long_profiles'],flush=True);print('ROCK CONTACT',[(r['name'],r['minmax_contact_m'],r['vertices_above_ground_fraction']) for r in out['rocks']],flush=True);print('GRASS',out['grass'],flush=True)
