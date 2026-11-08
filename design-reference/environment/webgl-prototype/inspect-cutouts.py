import bpy
from pathlib import Path
R=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(R.parent/'alpine-composition-01/echelon_alpine_composition_01.blend'))
for name in ['Norway Spruce - foreground-left stream shelter','SOURCE - Carthusian Pink']:
 o=bpy.data.objects[name];print('OBJECT',name,'UV',o.data.uv_layers.active.name,flush=True)
 for m in o.data.materials:
  print('MAT',m.name,flush=True)
  for n in m.node_tree.nodes:
   if n.type in ['TEX_IMAGE','UVMAP','ATTRIBUTE']:
    print(n.name,n.type,getattr(n,'uv_map',None),getattr(n,'attribute_name',None),getattr(getattr(n,'image',None),'name',None),[(i.name,l.from_node.name,l.from_node.type,l.from_socket.name) for i in n.inputs for l in i.links],flush=True)
