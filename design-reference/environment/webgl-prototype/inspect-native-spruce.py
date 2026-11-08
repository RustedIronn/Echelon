import bpy,json
bpy.ops.wm.open_mainfile(filepath=r'D:\Projects\Echelon\design-reference\environment\alpine-composition-01\echelon_alpine_composition_01.blend',load_ui=False)
for o in bpy.context.scene.objects:
 if not o.name.startswith('Norway Spruce - foreground'):continue
 print('TREE',o.name,o.dimensions[:],flush=True)
 for m in o.data.materials:
  print('MATERIAL',m.name,flush=True)
  for n in m.node_tree.nodes:
   if n.type=='MATH':print('MATH',n.name,n.operation,[(i.name,i.default_value) for i in n.inputs],flush=True)
   if n.type=='BSDF_PRINCIPLED':print('PRINCIPLED',[(i.name,[(l.from_node.name,l.from_socket.name) for l in i.links] if i.is_linked else list(i.default_value) if hasattr(i.default_value,'__len__') else i.default_value) for i in n.inputs if hasattr(i,'default_value')],flush=True)
   if n.type=='TEX_IMAGE':print('IMAGE',n.image.name if n.image else None,n.image.colorspace_settings.name if n.image else None,flush=True)
  print('LINKS',[(l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name) for l in m.node_tree.links],flush=True)

import numpy as np
for label,im in [('native',bpy.data.images.get('Image_2.003')),('runtime',bpy.data.images.load(r'D:\Projects\Echelon\design-reference\environment\webgl-prototype\cache\spruce-color-runtime.png'))]:
 px=np.array(im.pixels[:]).reshape((-1,4));print('ALPHA',label,im.size[:],np.quantile(px[:,3],[0,.1,.5,.9,1]).tolist(),'fraction passing .3',float((px[:,3]>.3).mean()),flush=True)
