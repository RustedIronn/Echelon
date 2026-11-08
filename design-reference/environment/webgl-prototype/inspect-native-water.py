import bpy,json
bpy.ops.wm.open_mainfile(filepath=r'D:\Projects\Echelon\design-reference\environment\alpine-composition-01\echelon_alpine_composition_01.blend',load_ui=False)
o=bpy.data.objects.get('Water inside carved channel - static graded surface')
for m in o.data.materials:
 print('WATER_MATERIAL',m.name,flush=True)
 for n in m.node_tree.nodes:
  print(n.name,n.type,[(i.name,list(i.default_value) if hasattr(i.default_value,'__len__') else i.default_value) for i in n.inputs if hasattr(i,'default_value') and not i.is_linked],flush=True)
