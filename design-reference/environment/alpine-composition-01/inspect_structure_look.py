import bpy,json,numpy as np
from pathlib import Path
r=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'));s=bpy.context.scene
print('COLOR',s.view_settings.view_transform,s.view_settings.look,s.view_settings.exposure,[i.identifier for i in s.view_settings.bl_rna.properties['look'].enum_items],flush=True)
for o in s.objects:
 if o.type=='LIGHT':print('LIGHT',o.name,list(o.location),list(o.rotation_euler),o.data.energy,list(o.data.color),getattr(o.data,'angle',None))
 if o.type=='MESH' and ('stone' in o.name.lower() or 'rock' in o.name.lower()) and not o.name.startswith(('Village','SOURCE')):print('STONE',o.name,len(o.data.vertices),list(o.location),list(o.scale),[m.name for m in o.data.materials])
g=bpy.data.objects['Continuous meadow foothills and mountain range'];n=len(g.data.vertices);a=np.empty((n,3),np.float32);g.data.vertices.foreach_get('co',a.ravel());mount=a[:,1]>260
for name in ['alpine_rock','alpine_snow','mountain_drainage','mountain_incision','mountain_talus']:
 v=np.empty(n,np.float32);g.data.attributes[name].data.foreach_get('value',v);print('TERRAIN ATTRIBUTE',name,[float(np.quantile(v[mount],q)) for q in [0,.5,.9,.99,1]])
t=bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks']
for node in t.nodes:
 if node.type=='VECT_MATH' and 'rock' in node.name:print('ROCK SCALE',node.name,[list(v.default_value) for v in node.inputs if v.type=='VECTOR'])
for mat in bpy.data.materials:
 if 'aerial perspective' in mat.name:
  for node in mat.node_tree.nodes:
   if node.type=='MAP_RANGE':print('HAZE',mat.name,node.name,[(i.name,i.default_value) for i in node.inputs if i.type=='VALUE'])
