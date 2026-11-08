import bpy,numpy as np,json,sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
r=Path(__file__).resolve().parent;sys.path.insert(0,str(r));from cohesion_fields import CohesionFields
m=json.loads((r/'cohesion_source.json').read_text());z=np.load(r/'cohesion_source.npz');f=CohesionFields(z['tributary_sections'],m['paths']);a=z[m['meshes']['Continuous meadow foothills and mountain range']['key']];bars,erosion,level,shore,active=f.shore_fields(a[:,0],a[:,1]);bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'));s=bpy.context.scene;g=bpy.data.objects['Continuous meadow foothills and mountain range']
for ymin,ymax in [(65,80),(105,120),(150,165)]:
 ids=np.flatnonzero((a[:,1]>ymin)&(a[:,1]<ymax));ids=ids[np.argsort(bars[ids])[-4:]]
 for i in ids:
  p=g.data.vertices[int(i)].co;print('BAR',float(bars[i]),'shore',float(shore[i]),'old',a[i].tolist(),'now',list(p),'water',float(level[i]),'screen',list(world_to_camera_view(s,s.camera,p)),'bedattr',g.data.attributes['streambed'].data[int(i)].value,flush=True)
for mat in g.data.materials:
 print('TERRAIN MATERIAL',mat.name,[(n.name,n.node_tree.name) for n in mat.node_tree.nodes if n.type=='GROUP'],flush=True)
t=bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks']
for n in t.nodes:
 if n.type=='ATTRIBUTE':print('ATTR',n.name,n.attribute_name)
print('WATER MATERIAL',bpy.data.objects['Water inside carved channel - static graded surface'].data.materials[0].name)
