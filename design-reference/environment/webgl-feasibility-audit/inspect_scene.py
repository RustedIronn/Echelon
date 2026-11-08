"""Read-only saved-scene audit. Does not save or export Blender data."""
import bpy,json,hashlib,time,math
from pathlib import Path
from collections import Counter
from mathutils import Vector
R=Path(__file__).resolve().parent
P=R.parent/'alpine-composition-01/echelon_alpine_composition_01.blend'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for c in iter(lambda:f.read(8*1024*1024),b''):h.update(c)
 return h.hexdigest()
before=sha(P);bpy.ops.wm.open_mainfile(filepath=str(P));s=bpy.context.scene;dg=bpy.context.evaluated_depsgraph_get()
print('OPENED',P,flush=True)
def counts(m):return {'vertices':len(m.vertices),'polygons':len(m.polygons),'triangles':sum(len(p.vertices)-2 for p in m.polygons)}
def vis(o):
 return not o.hide_render and all(not c.hide_render for c in o.users_collection) # collection hierarchy additionally recorded below
objects=[]
for o in s.objects:
 row={'name':o.name,'type':o.type,'hide_render':o.hide_render,'hide_viewport':o.hide_viewport,'visible_view_layer':o.visible_get(),'collections':[c.name for c in o.users_collection],'materials':[m.name for m in o.data.materials if m] if o.type=='MESH' else [],'dimensions':list(o.dimensions),'modifiers':[{'name':m.name,'type':m.type,'viewport':m.show_viewport,'render':m.show_render} for m in o.modifiers]}
 if o.type=='MESH':
  row['raw']=counts(o.data);row['uv_layers']=[u.name for u in o.data.uv_layers];row['attributes']=[(a.name,a.domain,a.data_type) for a in o.data.attributes]
  if row['visible_view_layer']:
   e=o.evaluated_get(dg);m=e.to_mesh();row['evaluated_viewport']=counts(m);e.to_mesh_clear()
 objects.append(row)
print('OBJECTS',len(objects),flush=True)
# Depsgraph instances are viewport evaluation, not a Cycles render workload. Keep separate from originals.
instances=Counter();instance_tris=Counter();source_counts={}
for i in dg.object_instances:
 if not i.is_instance or not i.show_self:continue
 o=i.object;key=(i.parent.original.name if i.parent else '<none>',o.original.name)
 if o.type=='MESH':
  if o.name not in source_counts:source_counts[o.name]=counts(o.data)
  instances[key]+=1;instance_tris[key]+=source_counts[o.name]['triangles']
print('INSTANCES',sum(instances.values()),flush=True)
# Reachable material nodes only: track image references recursively, not every retained datablock.
def treeinfo(tree,seen=None):
 if not tree:return {'types':{},'images':[]}
 seen=seen or set()
 if tree.as_pointer() in seen:return {'types':{},'images':[]}
 seen.add(tree.as_pointer());types=Counter();imgs=set();visited=set()
 def visit(n):
  if n.as_pointer() in visited:return
  visited.add(n.as_pointer());types[n.bl_idname]+=1
  if n.type=='TEX_IMAGE' and n.image:imgs.add(n.image.name)
  if n.type=='GROUP' and n.node_tree:
   q=treeinfo(n.node_tree,seen);types.update(q['types']);imgs.update(q['images'])
  for inp in n.inputs:
   for link in inp.links:visit(link.from_node)
 outputs=[n for n in tree.nodes if n.type in {'OUTPUT_MATERIAL','OUTPUT_WORLD','GROUP_OUTPUT','COMPOSITE','OUTPUT_FILE'} and getattr(n,'is_active_output',True)]
 for n in outputs:visit(n)
 return {'types':dict(types),'images':sorted(imgs)}
usedmat=set(m for o in objects if o['visible_view_layer'] for m in o['materials'])
usedmat.update(m.name for key in instances for m in bpy.data.objects[key[1]].data.materials if m)
materials={m.name:treeinfo(m.node_tree) for m in bpy.data.materials if m.name in usedmat}
world=treeinfo(s.world.node_tree if s.world else None);usedimgs=set(world['images'])
for m in materials.values():usedimgs.update(m['images'])
images=[]
for im in bpy.data.images:
 images.append({'name':im.name,'size':list(im.size),'channels':im.channels,'depth':im.depth,'is_float':im.is_float,'colorspace':im.colorspace_settings.name,'packed':bool(im.packed_file),'packed_bytes':im.packed_file.size if im.packed_file else 0,'filepath':im.filepath,'used_by_visible_material_graph':im.name in usedimgs,'users':im.users})
c=s.camera
out={'scene_path':str(P),'blender':bpy.app.version_string,'scene_bytes':P.stat().st_size,'sha256_before':before,'camera':{'name':c.name,'location':list(c.location),'matrix_world':[list(r) for r in c.matrix_world],'lens_mm':c.data.lens,'sensor_width_mm':c.data.sensor_width,'sensor_fit':c.data.sensor_fit,'angle_x_degrees':math.degrees(c.data.angle_x),'angle_y_degrees':math.degrees(c.data.angle_y),'clip':[c.data.clip_start,c.data.clip_end],'dof':c.data.dof.use_dof},'render':{'engine':s.render.engine,'resolution':[s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage],'samples':s.cycles.samples,'view_transform':s.view_settings.view_transform,'look':s.view_settings.look,'exposure':s.view_settings.exposure},'world':world,'compositor':treeinfo(getattr(s,'compositing_node_group',None)),'lights':[{'name':o.name,'type':o.data.type,'energy':o.data.energy,'color':list(o.data.color)} for o in s.objects if o.type=='LIGHT'],'objects':objects,'instances_viewport':[{'parent':k[0],'source':k[1],'count':v,'expanded_triangles':instance_tris[k],'source_geometry':source_counts[k[1]]} for k,v in instances.items()],'materials_visible_graphs':materials,'images':images,'collections':[{'name':c.name,'hide_render':c.hide_render,'hide_viewport':c.hide_viewport} for c in bpy.data.collections]}
out['sha256_after']=sha(P);out['saved_scene_unchanged']=out['sha256_after']==before
(R/'scene-audit.json').write_text(json.dumps(out,indent=2))
print('AUDIT COMPLETE',out['saved_scene_unchanged'],flush=True)
