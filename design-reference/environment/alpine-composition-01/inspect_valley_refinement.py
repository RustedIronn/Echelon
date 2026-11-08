import bpy,json,sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
r=Path(__file__).resolve().parent;sys.path.insert(0,str(r))
from stream_network import StreamNetwork
bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'))
s=bpy.context.scene;g=bpy.data.objects['Continuous meadow foothills and mountain range'];m=g.modifiers.get('Tree habitat - local root microrelief');m.show_viewport=False
bpy.context.view_layer.update();bv=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get())
def height(x,y):
 p,n,*_=bv.ray_cast(Vector((x,y,300)),Vector((0,0,-1)),650);return round(p.z,3) if p else None
out={'profiles':{str(x):[[y,height(x,y)] for y in range(60,321,15)] for x in [-90,-45,0,35,75]},'objects':[],'materials':{}}
for o in s.objects:
 if o.name.startswith('Village ') and ('wall mass' in o.name or 'roof' in o.name or 'foundation' in o.name):
  a=[o.matrix_world@Vector(v) for v in o.bound_box];out['objects'].append({'name':o.name,'location':list(o.location),'corners':[list(p) for p in a],'seat':o.get('ground_seat_height'),'mats':[m.name for m in o.data.materials]})
for mat in bpy.data.materials:
 if mat.name.startswith(('Hamlet','Warm village','Muted clay','Meadow leaf')):
  out['materials'][mat.name]=[{'name':n.name,'type':n.type,'base_color':list(n.inputs['Base Color'].default_value),'links':[(l.from_node.name,l.to_socket.name) for l in mat.node_tree.links if l.to_node==n]} for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED']
(r/'valley_refinement_inspection.json').write_text(json.dumps(out,indent=2));print(json.dumps({'profiles':out['profiles'],'materials':out['materials']}),flush=True)
