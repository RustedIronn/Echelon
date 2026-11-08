import bpy,json,numpy as np
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
r=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'));s=bpy.context.scene
for o in s.objects:
 if o.name.startswith(('Meadow blooms - ','Sheltered fern','Norway Spruce - foreground')):
  print('OBJECT',o.name,'pos',list(o.location),'scale',list(o.scale),'hidden',o.hide_render,o.hide_get(),'dim',list(o.dimensions),flush=True)
  if o.type=='MESH' and o.name.startswith('Meadow blooms - '):
   a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());v=np.empty(len(a));o.data.attributes['tree_habitat_core'].data.foreach_get('value',v)
   print('POINTS',len(a),'excluded',sum(v>.64),'nearroots',a[np.argsort(np.linalg.norm(a[:,:2]-[-16.37,18.30],axis=1))[:4]].tolist())
   for m in o.modifiers:
    print('MOD',m.name,m.show_viewport,m.show_render,m.node_group.name)
    for n in m.node_group.nodes:
     if n.bl_idname in ['GeometryNodeInstanceOnPoints','GeometryNodeInputNamedAttribute','FunctionNodeBooleanMath','ShaderNodeMath']:
      print(' NODE',n.name,n.bl_idname,[(l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name) for l in m.node_group.links if l.to_node==n])
  if o.name.startswith('Sheltered fern'):
   box=[o.matrix_world@Vector(v) for v in o.bound_box];print('FERN SCREEN',[list(world_to_camera_view(s,s.camera,p)) for p in box][::3])
print('SPRUCE MATS',[m.name for m in bpy.data.objects['Norway Spruce - foreground-left stream shelter'].data.materials])
