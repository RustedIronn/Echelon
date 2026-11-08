import bpy
from pathlib import Path
R=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(R/'echelon_alpine_composition_01.blend'))
g=bpy.data.objects['Continuous meadow foothills and mountain range']
for mat in g.data.materials:
 print('MAT',mat.name)
 for n in mat.node_tree.nodes:
  if n.type=='GROUP':print('GROUP',n.name,n.node_tree.name)
  if n.type=='OUTPUT_MATERIAL':print('OUT',[(l.from_node.name,l.from_socket.name) for l in n.inputs['Surface'].links])
t=bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks']
for n in t.nodes:
 if n.type=='GROUP_OUTPUT':print('GROUPOUT',[(l.from_node.name,l.from_socket.name) for i in n.inputs for l in i.links])
im=t.nodes['Cohesion foot traffic'].image
for x,y in [(40,81),(42,87),(33,111),(33,113),(42,120)]:
 ix=round((x-18)/48*1023);iy=round((y-64)/89*1023);print('SAMPLE',x,y,im.pixels[(iy*1024+ix)*4])
print('MATINDICES',set(p.material_index for p in g.data.polygons))
