import bpy,json,numpy as np,math
from pathlib import Path
R=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(R.parent/'alpine-composition-01/echelon_alpine_composition_01.blend'));s=bpy.context.scene;dg=bpy.context.evaluated_depsgraph_get();c=s.camera
proj=c.calc_matrix_camera(dg,x=s.render.resolution_x,y=s.render.resolution_y,scale_x=s.render.pixel_aspect_x,scale_y=s.render.pixel_aspect_y);view=proj@c.matrix_world.inverted();M=np.array(view,dtype=np.float64)
out={'projection_matrix':[list(r) for r in proj],'render_vertical_fov_degrees':math.degrees(2*math.atan(1/proj[1][1])),'render_horizontal_fov_degrees':math.degrees(2*math.atan(1/proj[0][0])),'grass_roots':[],'modifier_visibility_mismatches':[],'node_attributes':{},'shader_specials':{},'animation_datablocks':len(bpy.data.actions),'camera_shift':[c.data.shift_x,c.data.shift_y]}
for name,block in {'Foreground arching grass':18,'Low basal meadow foliage':18,'Midground meadow continuation':12,'Meadow to foothill transition':12}.items():
 o=bpy.data.objects[name];co=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',co.ravel());roots=co.reshape((-1,block,3))[:,1,:];points=np.ones((len(roots),4));points[:,:3]=roots;clip=points@np.array(o.matrix_world).T@M.T;inside=(clip[:,3]>0)&(abs(clip[:,:3])<=clip[:,3,None]).all(axis=1)
 out['grass_roots'].append({'name':name,'raw_blades':len(roots),'roots_inside_nominal_hero_frustum':int(inside.sum()),'inside_fraction':float(inside.mean()),'method':'Original mesh blade root vertex 1 per authored 18/12-vertex block, all clip planes; excludes neither occlusion nor modifier deletions; not a triangle or pixel cost estimate.'})
for o in s.objects:
 for m in o.modifiers:
  if m.show_render!=m.show_viewport:out['modifier_visibility_mismatches'].append([o.name,m.name,m.show_viewport,m.show_render])
for ng in bpy.data.node_groups:
 if ng.bl_idname=='GeometryNodeTree':
  out['node_attributes'][ng.name]={'types':sorted(set(n.bl_idname for n in ng.nodes)),'attributes':[n.inputs['Name'].default_value for n in ng.nodes if n.bl_idname=='GeometryNodeInputNamedAttribute']}
for m in bpy.data.materials:
 if m.node_tree:
  specials=[]
  for n in m.node_tree.nodes:
   if n.type=='BSDF_PRINCIPLED':specials.append({'node':'Principled','transmission':n.inputs['Transmission Weight'].default_value,'IOR':n.inputs['IOR'].default_value,'roughness':n.inputs['Roughness'].default_value})
   elif n.type in {'VOLUME_ABSORPTION','VOLUME_SCATTER'}:specials.append({'node':n.type,'density':n.inputs['Density'].default_value})
  if specials:out['shader_specials'][m.name]=specials
out['water_visibility']={k:getattr(bpy.data.objects['Water inside carved channel - static graded surface'],k,None) for k in ['visible_shadow','visible_camera','visible_glossy','visible_transmission']}
out['world_nodes']=[{'type':n.type,'sky_type':getattr(n,'sky_type',None)} for n in s.world.node_tree.nodes];out['compositor_group_property']=[p.identifier for p in s.bl_rna.properties if 'compos' in p.identifier];out['startup_views']=[{'screen':screen.name,'view_perspective':area.spaces.active.region_3d.view_perspective} for screen in bpy.data.screens for area in screen.areas if area.type=='VIEW_3D']
(R/'camera-and-systems.json').write_text(json.dumps(out,indent=2));print(json.dumps({k:out[k] for k in ['render_vertical_fov_degrees','grass_roots','modifier_visibility_mismatches','animation_datablocks','water_visibility','compositor_group_property']},indent=2),flush=True)
