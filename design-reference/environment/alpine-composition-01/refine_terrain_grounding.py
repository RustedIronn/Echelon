"""Coherent terrain, settlement and bank contact, updated in the canonical scene.
Run without --commit for an unsaved visual check. Baselines prevent cumulative edits.
"""
import bpy,numpy as np,json,sys,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
R=Path(__file__).resolve().parent;sys.path.insert(0,str(R))
from habitat_structure_fields import HabitatStructure,smooth,noise2
from terrain_grounding_fields import main_range,hamlet_mask,shelf,lane_field,buildings_field,rock_contact,LANE
FILE=R/'echelon_alpine_composition_01.blend';bpy.ops.wm.open_mainfile(filepath=str(FILE));s=bpy.context.scene;c=s.camera;G='Continuous meadow foothills and mountain range';W='Water inside carved channel - static graded surface';GRASS={'Foreground arching grass':18,'Low basal meadow foliage':18,'Midground meadow continuation':12,'Meadow to foothill transition':12};g=bpy.data.objects[G]
def coords(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
archive=R/'grounding_pass_source.npz';jpath=R/'grounding_pass_source.json'
if not archive.exists():
 data={};meta={'meshes':{},'objects':{},'buildings':json.loads((R/'alpine_identity_report.json').read_text())['buildings'],'camera':[list(v) for v in c.matrix_world],'lens':c.data.lens,'water_hash':hashlib.sha256(coords(bpy.data.objects[W]).tobytes()).hexdigest()}
 targets=[g]+[bpy.data.objects[n] for n in GRASS]+[o for o in s.objects if o.name.startswith('Meadow blooms - ')]+[bpy.data.objects['Fluvial pebbles - three restrained sediment pockets']]
 hamlet=bpy.data.collections['11 Countryside hamlet - vernacular buildings']
 rocks=[o for o in s.objects if o.type=='MESH' and not o.hide_render and o.name.startswith(('Embedded limestone anchor','Bank limestone','Low meadow limestone'))]
 targets+=list(hamlet.all_objects)+rocks
 for i,o in enumerate(targets):
  key='m'+str(i);data[key]=coords(o);rec={'key':key,'attributes':{}}
  for at in o.data.attributes:
   wanted=(o.name==G and at.domain=='POINT' and at.data_type=='FLOAT') or (at.name in ['tree_habitat_thin','tree_habitat_z','tree_habitat_core','plant_scale','plant_rotation','stone_scale','stone_rotation'])
   if not wanted:continue
   vector=at.data_type=='FLOAT_VECTOR';arr=np.empty((len(at.data),3) if vector else len(at.data),np.float32 if vector or at.data_type!='BOOLEAN' else np.bool_);at.data.foreach_get('vector' if vector else 'value',arr.ravel());akey=key+'_'+at.name;data[akey]=arr;rec['attributes'][at.name]={'key':akey,'type':at.data_type,'domain':at.domain}
  meta['meshes'][o.name]=rec
  if o in rocks or o.name in hamlet.all_objects:
   meta['objects'][o.name]={'matrix':[list(v) for v in o.matrix_world],'materials':[m.name if m else None for m in o.data.materials]}
   for mat in o.data.materials:
    if mat:mat.use_fake_user=True
 np.savez_compressed(archive,**data);jpath.write_text(json.dumps(meta,indent=2));print('GROUNDING SOURCE CAPTURED',flush=True)
meta=json.loads(jpath.read_text());src=np.load(archive)
def original(name):return src[meta['meshes'][name]['key']]
def original_attr(name,at):return src[meta['meshes'][name]['attributes'][at]['key']].copy()
def attr(o,name,a,domain='POINT',kind='FLOAT'):
 at=o.data.attributes.get(name) or o.data.attributes.new(name,kind,domain);at.data.foreach_set('vector' if kind=='FLOAT_VECTOR' else 'value',np.asarray(a).ravel())
for name,rec in meta['meshes'].items():
 o=bpy.data.objects[name];o.data.vertices.foreach_set('co',src[rec['key']].ravel());o.data.update()
 for at,v in rec['attributes'].items():attr(o,at,src[v['key']],v['domain'],v['type'])
 if name in meta['objects']:
  o.parent=None;o.matrix_world=Matrix(meta['objects'][name]['matrix'])
  for i,matname in enumerate(meta['objects'][name]['materials']):
   if matname:o.data.materials[i]=bpy.data.materials[matname]
for o in list(s.objects):
 if o.name.startswith('Grounded hamlet placement '):bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.update();before=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get())
def z(bv,x,y):
 p,*_=bv.ray_cast(Vector((float(x),float(y),350)),Vector((0,0,-1)),900);assert p is not None,(x,y);return p.z
sections=np.load(R/'habitat_structure_source.npz');field=HabitatStructure([sections['sections0'],sections['sections1']]);a=original(G);x,y,oldz=a.T;new=a.copy();d,level,side,which=field.bank(x,y)
# Calm piedmont: remove the three shallow noisy terrain copies, derive the
# transition direction from the genuine main-range toe rather than wavy noise.
A=R.parent/'asset-auditions/mountain-foundation';heightmap=np.load(A/'terrain002_height.npy');specs=[v for v in json.loads((A/'foundation_C_report.json').read_text())['summit_transforms'] if v[4]>=45]
tx=np.linspace(-620,620,621);ty=np.linspace(350,700,351);xx,yy=np.meshgrid(tx,ty);aux=main_range(heightmap,xx.ravel(),yy.ravel(),specs).reshape(len(ty),len(tx));hit=aux>4;toe=ty[np.argmax(hit,axis=0)];toe[~hit.any(axis=0)]=650;toe=np.convolve(np.pad(toe,(12,12),mode='edge'),np.ones(25)/25,mode='valid')
refx=np.linspace(-215,215,45);refz=np.array([z(before,px,185) for px in refx]);refz=np.convolve(np.pad(np.clip(refz,8.5,12.5),(2,2),mode='edge'),np.ones(5)/5,mode='valid')
ids=np.flatnonzero(y>185);xx=x[ids];yy=y[ids];toe_at=np.interp(xx,tx,toe);start=np.interp(xx,refx,refz);t=np.clip((yy-185)/(toe_at-185),0,1);piedmont=start+11*(.35*t+.65*t*t)+.025*np.maximum(0,yy-toe_at)
main=main_range(heightmap,xx,yy,specs);native_base=6+.034*np.maximum(0,yy-268)+1.0*(noise2(xx,yy,43,23)-.5);native=native_base+main;k=.65;f=np.clip(.5+.5*(piedmont-native)/k,0,1);target=native*(1-f)+piedmont*f+k*f*(1-f)
# Preserve the established mountain faces and skyline exactly.
keep=smooth((main-5)/12);target=target*(1-keep)+oldz[ids]*keep;weight=smooth((yy-185)/65)*smooth((d[ids]-.4)/2);new[ids,2]=oldz[ids]*(1-weight)+target*weight
# Broad, lightly graded village shelf. Channel stage constrains its west edge.
site=hamlet_mask(x,y)*smooth((d-.4)/2);plane=shelf(x,y,d,level);new[:,2]=new[:,2]*(1-site)+plane*site;g.data.vertices.foreach_set('co',new.ravel());g.data.update()
# Remove residual rock colouring from the newly quiet, nearly level piedmont.
norm=np.array([v.normal[:] for v in g.data.vertices],np.float32);change=abs(new[:,2]-oldz);blend=smooth((change-.02)/.3)*smooth((y-185)/60);rock=original_attr(G,'alpine_rock');rock_new=rock*smooth((.995-norm[:,2])/.18);attr(g,'alpine_rock',rock*(1-blend)+rock_new*blend)
bpy.context.view_layer.update();after=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get())
# Five modest buildings face a shared lane/green, with small unequal offsets.
newxy=[(33.53,116.65),(44.5,122.5),(29.5,133.0),(43.2,137.0),(36.8,147.5)];turns=[0,-6,8,7,-4];oldaxes=json.loads((R/'country_geology_source.json').read_text())['buildings'];buildings=[];doors=[]
parent=bpy.data.collections['11 Countryside hamlet - vernacular buildings']
for i,sub in enumerate(parent.children):
 rec=meta['buildings'][i];origin=Vector(rec['origin']);angle=math.radians(turns[i]);rot=Matrix.Rotation(angle,4,'Z');door0=Vector(rec['front_door_xy']+[origin.z]);neworigin=Vector([*newxy[i],0]);newdoor=neworigin+rot.to_3x3()@(door0-origin);neworigin.z=z(after,newdoor.x,newdoor.y)+.055;newdoor.z=neworigin.z
 empty=bpy.data.objects.new('Grounded hamlet placement '+str(i+1),None);sub.objects.link(empty);empty.empty_display_type='PLAIN_AXES';empty.empty_display_size=.65;empty.matrix_world=Matrix.Translation(neworigin)@rot
 for o in list(sub.objects):
  if o==empty:continue
  o.parent=empty;o.matrix_parent_inverse=Matrix.Translation(-origin);o.matrix_basis=Matrix(meta['objects'][o.name]['matrix'])
  # Porch feet extend a little below turf, independently of the threshold floor.
  # A steeper rear-house roof breaks the coincident roof silhouette without
  # changing doors, windows or human-scale wall proportions.
  if i==3:
   eave=origin.z+4.15
   for v in o.data.vertices:
    if v.co.z>eave:v.co.z=eave+1.30*(v.co.z-eave)
   o.data.update()
  if 'Weathered porch posts' in o.name:
   for v in o.data.vertices:
    if v.co.z<origin.z+.04:v.co.z-=.18
   o.data.update()
 ax=oldaxes[i]['ax'];absolute=math.atan2(ax[1],ax[0])+angle;buildings.append({'origin':list(neworigin),'angle':absolute,'footprint':rec['footprint_m'],'collection':sub.name});doors.append([newdoor.x,newdoor.y])
# Related but distinguishable stone, roughcast and slate; no bright toy colours.
def graded_copy(source,name,color,isstone=False):
 source.use_fake_user=True;mat=bpy.data.materials.get(name) or source.copy();mat.name=name;nt=mat.node_tree
 for n in nt.nodes:
  if n.type=='VALTORGB':n.color_ramp.elements[0].color=(*(v*.80 for v in color),1);n.color_ramp.elements[-1].color=(*(v*1.12 for v in color),1)
  if n.type=='TEX_BRICK':
   for key,scale in [('Color1',1),('Color2',.78),('Mortar',.70)]:n.inputs[key].default_value=(*(v*scale for v in color),1)
 return mat
wallcolors=[(.31,.31,.28),(.48,.435,.33),(.28,.255,.21),(.395,.42,.385),(.47,.455,.41)];roofcolors=[(.08,.092,.098),(.105,.09,.075),(.075,.086,.09),(.085,.105,.12),(.095,.10,.095)]
for i,sub in enumerate(parent.children):
 wall=None;roof=None
 for o in sub.objects:
  if o.type!='MESH' or not len(o.data.materials):continue
  if any(q in o.name for q in ['Front masonry','Back masonry','End masonry','Masonry gables','Low service wing']):
   if wall is None:wall=graded_copy(o.data.materials[0],'Grounded hamlet wall '+str(i+1),wallcolors[i])
   o.data.materials[0]=wall
  if any(q in o.name for q in ['Laid slate courses','Roof structure','Porch slate shelter','Service wing slate','Slate tower cap']):
   if roof is None:
    roof=graded_copy(o.data.materials[0],'Grounded hamlet slate '+str(i+1),roofcolors[i]);nt=roof.node_tree;geom=nt.nodes.get('Individual slate variation') or nt.nodes.new('ShaderNodeNewGeometry');geom.name='Individual slate variation'
    for n in nt.nodes:
     if n.type=='VALTORGB':
      nt.links.new(geom.outputs['Random Per Island'],n.inputs[0]);n.color_ramp.elements[0].color=(*(v*.94 for v in roofcolors[i]),1);n.color_ramp.elements[-1].color=(*(v*1.04 for v in roofcolors[i]),1)
   o.data.materials[0]=roof
  if i==1 and any(q in o.name for q in ['Panelled doors','Door panels']):o.data.materials[0]=graded_copy(o.data.materials[0],'Grounded cottage olive timber',(.08,.115,.07))
bpy.context.view_layer.update()
# Shape and bury the visible stones against the actual local ground, rather than
# seating only their object origins on it. Existing counts and group locations stay.
rocks=[];contacts=[]
for name,rec in meta['objects'].items():
 if not name.startswith(('Embedded limestone anchor','Bank limestone','Low meadow limestone')):continue
 o=bpy.data.objects[name];o.data=o.data.copy();o.data.name='Grounded bank stone '+name;local=original(name).copy();lo,hi=local[:,2].min(),local[:,2].max()
 if name.startswith(('Embedded','Low meadow')):
  cap=lo+.62*(hi-lo);local[:,2]=np.where(local[:,2]>cap,cap+.70*(local[:,2]-cap),local[:,2])
 o.data.vertices.foreach_set('co',local.ravel());o.data.update();j=len(rocks);o.rotation_euler.x+=.075*math.sin(j*1.7);o.rotation_euler.y+=.06*math.cos(j*1.3);bpy.context.view_layer.update();points=[o.matrix_world@v.co for v in o.data.vertices];relative=np.array([p.z-z(after,p.x,p.y) for p in points]);o.location.z-=float(np.quantile(relative,.66 if name.startswith('Embedded') else .63));bpy.context.view_layer.update();points=np.array([tuple(o.matrix_world@v.co) for v in o.data.vertices]);ground=np.array([z(after,p[0],p[1]) for p in points]);deltas=points[:,2]-ground;above=deltas>0
 centre=points.mean(0);radii=np.maximum((points.max(0)-points.min(0))[:2]*.55,.06);rocks.append({'name':name,'xy':centre[:2].tolist(),'radii':radii.tolist(),'angle':0.0});contacts.append({'name':name,'fraction_vertices_above_ground':float(above.mean()),'top_above_ground_m':float(deltas.max()),'burial_m':float(-deltas.min())})
contact=rock_contact(x,y,rocks);shore=(1-smooth((np.abs(d)-2.0)/2.5));bed=original_attr(G,'streambed');attr(g,'bank_rock_contact',contact*shore);attr(g,'streambed',np.maximum(bed,contact*shore*.68));attr(g,'damp_soil',np.maximum(original_attr(G,'damp_soil'),contact*shore*.30))
# One packed lane mask replaces the branching old network.
n=1024;gx,gy=np.meshgrid(np.linspace(0,80,n),np.linspace(25,166,n));wear=lane_field(gx.ravel(),gy.ravel(),doors);rgba=np.ones((n*n,4),np.float32);rgba[:,:3]=wear[:,None]
nt=bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks'];image=bpy.data.images.get('Grounded hamlet single lane') or bpy.data.images.new('Grounded hamlet single lane',width=n,height=n,alpha=True);image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(rgba.ravel());image.filepath_raw=str(R/'grounded_hamlet_lane.png');image.file_format='PNG';image.save();image.pack();nt.nodes['Cohesion foot traffic'].image=image;nt.nodes['Cohesion mask origin'].inputs[1].default_value=(0,25,0);nt.nodes['Cohesion mask metres'].inputs[1].default_value=(1/80,1/141,0)
if nt.nodes.get('Damp bank transition'):nt.nodes['Damp bank transition'].inputs[2].default_value=(.095,.08,.055,1)
if nt.nodes.get('Dampness strength'):nt.nodes['Dampness strength'].inputs[1].default_value=.16
# Fragment-scale contact avoids relying on metre-spaced terrain vertices
# to describe a small partly buried stone's gravel/turf interface.
cn=2048;cx,cy=np.meshgrid(np.linspace(-100,45,cn,dtype=np.float32),np.linspace(-10,150,cn,dtype=np.float32));cc=rock_contact(cx.ravel(),cy.ravel(),rocks);cd,*_=field.bank(cx.ravel(),cy.ravel());cc*=1-smooth((np.abs(cd)-2.0)/2.5);rgba2=np.ones((cn*cn,4),np.float32);rgba2[:,:3]=cc[:,None]
contact_image=bpy.data.images.get('Grounded bank stone contact') or bpy.data.images.new('Grounded bank stone contact',width=cn,height=cn,alpha=True);contact_image.colorspace_settings.name='Non-Color';contact_image.pixels.foreach_set(rgba2.ravel());contact_image.filepath_raw=str(R/'grounded_bank_contact.png');contact_image.file_format='PNG';contact_image.save();contact_image.pack()
def shader_node(kind,name):
 n=nt.nodes.get(name) or nt.nodes.new(kind);n.name=name;return n
pos=nt.nodes['Cohesion world ground coordinates'].outputs['Position'];offset=shader_node('ShaderNodeVectorMath','Grounding bank contact origin');offset.operation='SUBTRACT';offset.inputs[1].default_value=(-100,-10,0);nt.links.new(pos,offset.inputs[0]);scale=shader_node('ShaderNodeVectorMath','Grounding bank contact scale');scale.operation='MULTIPLY';scale.inputs[1].default_value=(1/145,1/160,0);nt.links.new(offset.outputs[0],scale.inputs[0]);tex=shader_node('ShaderNodeTexImage','Grounding bank contact mask');tex.image=contact_image;tex.extension='CLIP';nt.links.new(scale.outputs[0],tex.inputs['Vector']);factor=shader_node('ShaderNodeMath','Grounding bank contact strength');factor.operation='MULTIPLY';factor.inputs[1].default_value=.48;nt.links.new(tex.outputs['Color'],factor.inputs[0])
mineral=shader_node('ShaderNodeMixRGB','Grounding bank mineral earth');mineral.inputs[0].default_value=.32;nt.links.new(nt.nodes['Scanned gravel and finer sediment'].outputs[0],mineral.inputs[1]);nt.links.new(nt.nodes['earth scanned color'].outputs[0],mineral.inputs[2]);contactmix=shader_node('ShaderNodeMixRGB','Grounding bank turf mineral contact');nt.links.new(factor.outputs[0],contactmix.inputs[0]);nt.links.new(nt.nodes['Tree habitat - soil response'].outputs[0],contactmix.inputs[1]);nt.links.new(mineral.outputs[0],contactmix.inputs[2]);nt.links.new(contactmix.outputs[0],nt.nodes['Cohesion worn village ground'].inputs[1])
# Local compacted earth with some gravel, rather than a uniform grey stripe.
earthmix=shader_node('ShaderNodeMixRGB','Grounding village earth gravel');earthmix.inputs[0].default_value=.24;nt.links.new(nt.nodes['earth scanned color'].outputs[0],earthmix.inputs[1]);nt.links.new(nt.nodes['Scanned gravel and finer sediment'].outputs[0],earthmix.inputs[2]);warm=shader_node('ShaderNodeMixRGB','Grounding village lane mineral tone');warm.blend_type='MIX';warm.inputs[0].default_value=.65;warm.inputs[2].default_value=(.22,.175,.115,1);nt.links.new(earthmix.outputs[0],warm.inputs[1]);nt.links.new(warm.outputs[0],nt.nodes['Cohesion worn village ground'].inputs[2])
# Restrained worn margins immediately against foundations, with no new road spurs.
housewear=buildings_field(x,y,buildings);attr(g,'streambed',np.maximum(np.maximum(bed,contact*shore*.68),housewear*.22))

# Existing plants follow the new actual surface. Only local traffic/building/stone
# exclusions change; the botanical sources and foreground composition remain.
def mapped(roots):
 out=roots.copy();dz=np.zeros(len(roots),np.float32);selected=(roots[:,1]>185)|(hamlet_mask(roots[:,0],roots[:,1])>0)
 for i in np.flatnonzero(selected):dz[i]=z(after,roots[i,0],roots[i,1])-z(before,roots[i,0],roots[i,1])
 out[:,2]+=dz;return out,dz
report={'buildings':buildings,'doors':doors,'stones':contacts,'grass':{},'flowers':{},'piedmont_toe_x':tx.tolist(),'piedmont_toe_y':toe.tolist(),'lane_control_points':LANE.tolist()}
for name,block in GRASS.items():
 o=bpy.data.objects[name];a0=original(name);chunks=a0.reshape((-1,block,3));roots=chunks[:,1,:];newroots,dz=mapped(roots);out=chunks+np.stack([np.zeros_like(dz),np.zeros_like(dz),dz],axis=1)[:,None,:];o.data.vertices.foreach_set('co',out.astype(np.float32).ravel());o.data.update();xx,yy=newroots[:,:2].T;lane=lane_field(xx,yy,doors);houses=buildings_field(xx,yy,buildings);stones=rock_contact(xx,yy,rocks);thin=original_attr(name,'tree_habitat_thin').reshape((-1,2*(block//3-1)));site=hamlet_mask(xx,yy);thin[site>.30]=False;seed=np.mod(np.sin(xx*91.3+yy*173.2)*43758.54,1);distance,lev,*_=field.bank(xx,yy);follow=original_attr(name,'tree_habitat_z').reshape((-1,block))[:,1];wet=(newroots[:,2]+follow<lev+.025)&(distance<.3);clear=(seed<lane*.99)|(houses>.25)|(stones>.62)|wet;thin|=clear[:,None];attr(o,'tree_habitat_thin',thin.ravel(),domain='FACE',kind='BOOLEAN');report['grass'][name]={'retained_blades':len(roots),'root_shift_max_m':float(abs(dz).max()),'new_lane_roots':int((lane>.3).sum())};print('REGROUNDED',name,flush=True)
for name in meta['meshes']:
 if not name.startswith('Meadow blooms - '):continue
 o=bpy.data.objects[name];out,dz=mapped(original(name));o.data.vertices.foreach_set('co',out.ravel());o.data.update();xx,yy=out[:,:2].T;lane=lane_field(xx,yy,doors);houses=buildings_field(xx,yy,buildings);stones=rock_contact(xx,yy,rocks);core=original_attr(name,'tree_habitat_core');core[hamlet_mask(xx,yy)>.3]=0;core[(lane>.22)|(houses>.2)|(stones>.62)]=1;attr(o,'tree_habitat_core',core);report['flowers'][name]={'retained_points':len(out),'root_shift_max_m':float(abs(dz).max())}
# Existing pebbles follow bed relief with a small consistent embedment.
o=bpy.data.objects['Fluvial pebbles - three restrained sediment pockets'];a0=original(o.name);scale=original_attr(o.name,'stone_scale');out=a0.copy()
for i,p in enumerate(a0):out[i,2]=z(after,p[0],p[1])-.08*abs(scale[i,2])
o.data.vertices.foreach_set('co',out.ravel());o.data.update()
# Reuse the already packed cliff scan for a related stone mineral surface.
mat=bpy.data.materials['Habitat weathered limestone - existing maps'];mat.use_fake_user=True;mt=mat.node_tree;mt.nodes.clear();p=mt.nodes.new('ShaderNodeBsdfPrincipled');p.inputs['Roughness'].default_value=.78;p.inputs['Specular IOR Level'].default_value=.24;output=mt.nodes.new('ShaderNodeOutputMaterial');mt.links.new(p.outputs[0],output.inputs['Surface']);co=mt.nodes.new('ShaderNodeTexCoord');mapping=mt.nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs['Scale'].default_value=1/2.6;mt.links.new(co.outputs['Object'],mapping.inputs[0])
col=mt.nodes.new('ShaderNodeTexImage');col.image=bpy.data.images['marble_cliff_02_diff_4k.jpg'];col.projection='BOX';col.projection_blend=.14;mt.links.new(mapping.outputs[0],col.inputs['Vector']);grade=mt.nodes.new('ShaderNodeHueSaturation');grade.inputs['Saturation'].default_value=.23;grade.inputs['Value'].default_value=.50;mt.links.new(col.outputs['Color'],grade.inputs['Color']);mt.links.new(grade.outputs[0],p.inputs['Base Color']);height=mt.nodes.new('ShaderNodeTexImage');height.image=bpy.data.images['marble_cliff_02_disp_4k.exr'];height.projection='BOX';height.projection_blend=.14;mt.links.new(mapping.outputs[0],height.inputs['Vector']);bump=mt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.28;bump.inputs['Distance'].default_value=.018;mt.links.new(height.outputs[0],bump.inputs['Height']);mt.links.new(bump.outputs[0],p.inputs['Normal'])
assert [list(v) for v in c.matrix_world]==meta['camera'] and c.data.lens==meta['lens'];assert hashlib.sha256(coords(bpy.data.objects[W]).tobytes()).hexdigest()==meta['water_hash']
# The mountain faces with more than 17 m of native relief remain exact.
far=np.flatnonzero(y>185);protected=main>17;assert np.array_equal(new[far[protected]],a[far[protected]])
report.update(camera_unchanged=True,water_geometry_unchanged=True,protected_mountain_vertices=int(protected.sum()),protected_mountains_unchanged=True,terrain_change_min_m=float((new[:,2]-oldz).min()),terrain_change_max_m=float((new[:,2]-oldz).max()),single_lane=True)
(R/'grounding_pass_report.json').write_text(json.dumps(report,indent=2));prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for dev in prefs.devices:dev.use=dev.type!='CPU'
saved=(s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.render.use_border,s.render.use_crop_to_border)
s.cycles.device='GPU';s.cycles.samples=160;s.render.resolution_x=2560;s.render.resolution_y=1440;s.render.resolution_percentage=100;s.render.use_border=False;s.render.filepath=str(R/'grounding_pass_preview.png');bpy.ops.render.render(write_still=True)
s.render.resolution_x=3840;s.render.resolution_y=2160;s.render.use_border=True;s.render.use_crop_to_border=True
for filename,bounds in [('grounding_hamlet_detail.png',(.62,.90,.34,.60)),('grounding_bank_detail.png',(.45,.97,.22,.40))]:
 s.render.border_min_x,s.render.border_max_x,s.render.border_min_y,s.render.border_max_y=bounds;s.render.filepath=str(R/filename);bpy.ops.render.render(write_still=True)
s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.render.use_border,s.render.use_crop_to_border=saved
if '--commit' in sys.argv:
 bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
print('COHERENT GROUNDING COMPLETE',json.dumps({k:v for k,v in report.items() if k not in ['piedmont_toe_x','piedmont_toe_y','lane_control_points']}),flush=True)
