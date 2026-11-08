"""Reference-led mountain face structure, countryside individuality and readable paths."""
import bpy,numpy as np,json,sys,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
R=Path(__file__).resolve().parent;sys.path.insert(0,str(R))
from habitat_structure_fields import smooth,noise2
from countryside_architecture import build_settlement
FILE=R/'echelon_alpine_composition_01.blend';bpy.ops.wm.open_mainfile(filepath=str(FILE));s=bpy.context.scene;c=s.camera;G='Continuous meadow foothills and mountain range';g=bpy.data.objects[G]
def coords(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
def getat(n):
 a=np.empty(len(g.data.vertices),np.float32);g.data.attributes[n].data.foreach_get('value',a);return a
def putat(n,a):
 at=g.data.attributes.get(n) or g.data.attributes.new(n,'FLOAT','POINT');at.data.foreach_set('value',np.asarray(a,np.float32))
source=R/'alpine_identity_source.npz';jfile=R/'alpine_identity_source.json'
if not source.exists():
 np.savez_compressed(source,xyz=coords(g),rock=getat('alpine_rock'),snow=getat('alpine_snow'))
 jfile.write_text(json.dumps({'camera':[list(v) for v in c.matrix_world],'lens':c.data.lens,'sun':bpy.data.objects['Simple afternoon sun'].data.energy,'water_vertices':len(bpy.data.objects['Water inside carved channel - static graded surface'].data.vertices)},indent=2))
base=np.load(source);a=base['xyz'];g.data.vertices.foreach_set('co',a.ravel());g.data.update();x,y,z=a.T
# The broad drainage remains; new rock masses have varied wavelengths and exposure.
wx=x+6*(noise2(x,y,24,8)-.5)+2.4*(noise2(x,y,9,2)-.5)
wy=y+4*(noise2(x,y,19,11)-.5)+.18*z
def triangular_noise(x,y,size,seed):
 qx=x/size;qy=y/size;ix=np.floor(qx);iy=np.floor(qy);u=qx-ix;v=qy-iy
 def h(i,j):return np.mod(np.sin(i*127.1+j*311.7+seed*74.13)*43758.5453,1)
 a=h(ix,iy);b=h(ix+1,iy);cc=h(ix,iy+1);d=h(ix+1,iy+1)
 return np.where(u+v<1,a+(b-a)*u+(cc-a)*v,d+(cc-d)*(1-u)+(b-d)*(1-v))
coarse=.65*triangular_noise(wx,wy,11,31)+.35*noise2(wx,wy,13,31);middle=noise2(wx,wy,4.8,77);fine=noise2(wx,wy,1.65,42)
# F2-F1 joints: irregular cells rather than sinusoidal parallel grooves.
xx=wx/8;yy=(wy+.48*z)/11;ix=np.floor(xx);iy=np.floor(yy);best=np.full(len(a),1e5);second=best.copy()
for dx in [-1,0,1]:
 for dy in [-1,0,1]:
  cx=ix+dx;cy=iy+dy;jx=np.mod(np.sin(cx*127.1+cy*311.7+19)*43758.54,1);jy=np.mod(np.sin(cx*269.5+cy*183.3+8)*43758.54,1);d=np.hypot(xx-cx-jx,yy-cy-jy);take=d<best;second=np.where(take,best,np.minimum(second,d));best=np.minimum(best,d)
edge=np.maximum(0,second-best);fracture=np.exp(-edge/.075)
mask=smooth((y-272)/38)*smooth((z-18)/18)*(1-smooth((y-455)/30))
# Three deliberately unequal face domains, with substantial quiet areas left intact.
activity=np.clip(.35+.85*noise2(x,y,34,20),0,1);rockbody=smooth((coarse-.30)/.42)
# Broad shoulders, secondary rock steps, and much smaller fractures.
delta=mask*activity*(4.9*(coarse-.48)+2.3*(middle-.48)+.65*(fine-.48)-2.5*fracture*rockbody)
lower=smooth((y-268)/24)*smooth((z-8)/12)*(1-smooth((z-27)/12))
delta+=lower*(1.15*(noise2(wx,wy,4.8,54)-.5)-.65*fracture)
delta=np.clip(delta,-4.4,3.2)
# Limit silhouette change without protecting an entire broad smooth band beneath it.
bpy.context.view_layer.update();oldbv=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get());frame=c.data.view_frame(scene=s);fx0=min(p.x/-p.z for p in frame);fx1=max(p.x/-p.z for p in frame);fy0=min(p.y/-p.z for p in frame);fy1=max(p.y/-p.z for p in frame)
us=np.linspace(0,1,301);h=[]
for u in us:
 lo=.30;hi=.84
 for k in range(20):
  v=(lo+hi)/2;di=(c.matrix_world.to_3x3()@Vector((fx0+(fx1-fx0)*u,fy0+(fy1-fy0)*v,-1))).normalized();p,*_=oldbv.ray_cast(c.location,di,1800)
  if p is None:hi=v
  else:lo=v
 h.append((lo+hi)/2)
inv=np.array(c.matrix_world.inverted());cp=a@inv[:3,:3].T+inv[:3,3];dep=-cp[:,2];u=(cp[:,0]/dep-fx0)/(fx1-fx0);v=(cp[:,1]/dep-fy0)/(fy1-fy0);protect=smooth((np.interp(np.clip(u,0,1),us,h)-v-.0025)/.009)
delta*=protect;new=a.copy();new[:,2]+=delta
from alpine_face_drainage import carve_faces
incision=carve_faces(new,protect);new[:,2]+=incision;delta+=incision;g.data.vertices.foreach_set('co',new.ravel());g.data.update()
norm=np.array([p.normal[:] for p in g.data.vertices]);nz=norm[:,2];drain=getat('mountain_drainage')
# Exposed faces and grassy interfluves are separate contiguous geological regions.
patch=noise2(wx,wy,6.5,16);exposure=smooth((.94-nz)/.37);height=smooth((new[:,2]-12)/27)
rock=np.clip(height*(.12+.92*exposure+.38*smooth((patch-.45)/.24)),0,1)
rock*=.65+.35*smooth((coarse-.22)/.45);rock=np.maximum(rock,lower*.48*smooth((patch-.48)/.28)*smooth((.96-nz)/.25))
blend=smooth((y-268)/30);putat('alpine_rock',base['rock']*(1-blend)+rock*blend)
# Sheltered gullies and ledges retain snow; steep projecting ribs stay exposed.
line=48+8*(noise2(wx,wy,17,81)-.5)-10*drain-3*fracture
snow=smooth((new[:,2]-line)/12)*smooth((nz-.33)/.43)
snow*=.28+.72*smooth((noise2(wx,wy,4.3,67)+.30*drain-.28)/.45)
# Persistent crest snow, broken by face orientation, not a horizontal cap.
snow=np.maximum(snow,smooth((new[:,2]-66)/12)*smooth((nz-.30)/.44)*.85)
putat('alpine_snow',base['snow']*(1-blend)+snow*blend);putat('alpine_face_fractures',fracture*mask)
# Restrained stone values with much clearer rock/grass/snow separation.
t=bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks'];t.nodes['Alpine rock mineral palette'].inputs['Saturation'].default_value=.38;t.nodes['Alpine rock mineral palette'].inputs['Value'].default_value=.95
t.nodes['Scanned alpine rock faces'].inputs[0].default_value=.58
t.nodes['rock world texture scale'].inputs['Scale'].default_value=1/13
t.nodes['Scanned geological relief'].inputs['Distance'].default_value=1.15
snowr=t.nodes['Snow broken by rock surface'].color_ramp;snowr.elements[0].color=(.48,.48,.48,1);snowr.elements[-1].color=(1,1,1,1)
# Readable local buff/gravel paths, preserving scanned texture variation.
road=t.nodes.get('Country worn limestone lane') or t.nodes.new('ShaderNodeMixRGB');road.name='Country worn limestone lane';road.inputs[0].default_value=.64;road.inputs[2].default_value=(.32,.265,.185,1);t.links.new(t.nodes['Cohesion trampled soil palette'].outputs[0],road.inputs[1]);t.links.new(road.outputs[0],t.nodes['Country lane daylight palette'].inputs['Color']);t.nodes['Country lane daylight palette'].inputs['Value'].default_value=1.12
# The current paths remain editable; their centre is cleared rather than carpeted by flattened grass.
im=t.nodes['Cohesion foot traffic'].image;pix=np.array(im.pixels[:],np.float32).reshape((-1,4));pass
# Replace the hamlet's existing authored parts only; all landscape objects stay intact.
col=bpy.data.collections['11 Countryside hamlet - vernacular buildings']
for o in list(col.all_objects):bpy.data.objects.remove(o,do_unlink=True)
for child in list(col.children):bpy.data.collections.remove(child)
bpy.context.view_layer.update();bv=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get())
def ground(x,y):
 p,*_=bv.ray_cast(Vector((float(x),float(y),350)),Vector((0,0,-1)),750);assert p is not None;return p.z
meta=json.loads((R/'country_geology_source.json').read_text());buildings=build_settlement(meta['buildings'],col,ground)
# Break the all-identical masonry/roof treatment with related mineral palettes.
for k,child in enumerate(col.children):
 for o in child.objects:
  if 'Front masonry' in o.name or 'End masonry' in o.name or 'Back masonry' in o.name or 'Masonry gables' in o.name:
   if k==4:
    mat=bpy.data.materials['Country pale gray limewash'];o.data.materials[0]=mat
  if 'Laid slate' in o.name or 'Roof structure' in o.name:
   mat=bpy.data.materials['Country weathered blue slate'];name='Country slate variation '+str(k);copy=bpy.data.materials.get(name) or mat.copy();copy.name=name
   p=next(n for n in copy.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Roughness'].default_value=.88
   for n in copy.node_tree.nodes:
    if n.type=='VALTORGB':
     colr=[(.075,.092,.095),(.11,.12,.115),(.105,.12,.13),(.075,.09,.10),(.12,.115,.10)][k]
     n.color_ramp.elements[0].color=(*(v*.72 for v in colr),1);n.color_ramp.elements[-1].color=(*(v*1.3 for v in colr),1)
   o.data.materials[0]=copy
# Stones use related pale weathered limestone rather than dark isolated brown lumps.
mat=bpy.data.materials.get('Habitat weathered limestone - existing maps')
if mat:
 nt=mat.node_tree;p=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED');old=p.inputs['Base Color'].links[0].from_socket;mix=nt.nodes.get('Pale waterworn mineral') or nt.nodes.new('ShaderNodeMixRGB');mix.name='Pale waterworn mineral';mix.inputs[0].default_value=.38;mix.inputs[2].default_value=(.32,.30,.255,1)
 if old.node!=mix:nt.links.new(old,mix.inputs[1])
 nt.links.new(mix.outputs[0],p.inputs['Base Color'])

# Camera-visible worn lanes join the existing entrance thresholds; this is an
# editable ground mask, never a mesh laid over the meadow.
from numpy import maximum as maximum
route=[]
for su,sv in [(.86,.386),(.84,.398),(.81,.411),(.78,.423),(.75,.436)]:
 di=(c.matrix_world.to_3x3()@Vector((fx0+(fx1-fx0)*su,fy0+(fy1-fy0)*sv,-1))).normalized();pt,*_=bv.ray_cast(c.location,di,1800);assert pt is not None;route.append([pt.x,pt.y])
thresholds=[(np.array(r['door_xy'])-.26*np.array(r['ay'][:2])).tolist() for r in meta['buildings']]
route.append(thresholds[0]);sidepaths=json.loads((R/'cohesion_source.json').read_text())['paths'];sidepaths[0][0]=thresholds[0];sidepaths[0][-1]=thresholds[1];sidepaths[1][-1]=thresholds[3];sidepaths[2][-1]=thresholds[2];sidepaths[3][-1]=thresholds[4];routes=[route]+sidepaths
bounds=(0,80,-5,153)
def lanes(x,y):
 out=np.zeros_like(x,dtype=np.float32)
 for k,points in enumerate(routes):
  dist=np.full(len(x),1e5)
  for aa,bb in zip(points[:-1],points[1:]):
   vx=bb[0]-aa[0];vy=bb[1]-aa[1];f=np.clip(((x-aa[0])*vx+(y-aa[1])*vy)/max(vx*vx+vy*vy,1e-8),0,1);dist=np.minimum(dist,np.hypot(x-aa[0]-f*vx,y-aa[1]-f*vy))
  width=(.83 if k==0 else .53)+.10*(noise2(x,y,1.7,12)-.5);out=np.maximum(out,1-smooth((dist-width)/.37))
 # Keep wear off the foreground stream and naturally feather its approach end.
 out*=smooth((y-route[0][1]+1)/3)
 return out
n=1024;gx,gy=np.meshgrid(np.linspace(bounds[0],bounds[1],n),np.linspace(bounds[2],bounds[3],n));vals=lanes(gx.ravel(),gy.ravel());rgba=np.ones((n*n,4),np.float32);rgba[:,:3]=vals[:,None]
im=t.nodes['Cohesion foot traffic'].image;im.pixels.foreach_set(rgba.ravel());im.save();im.pack();t.nodes['Cohesion mask origin'].inputs[1].default_value=(0,-5,0);t.nodes['Cohesion mask metres'].inputs[1].default_value=(1/80,1/158,0)
masksrc=R/'alpine_identity_vegetation_masks.npz'
grassblocks={'Foreground arching grass':18,'Low basal meadow foliage':18,'Midground meadow continuation':12,'Meadow to foothill transition':12}
if not masksrc.exists():
 data={}
 for k,(name,block) in enumerate(grassblocks.items()):
  o=bpy.data.objects[name];at=o.data.attributes['tree_habitat_thin'];values=np.empty(len(at.data),np.bool_);at.data.foreach_get('value',values);data['grass'+str(k)]=values
 for k,o in enumerate(sorted([o for o in s.objects if o.name.startswith('Meadow blooms - ')],key=lambda x:x.name)):
  values=np.empty(len(o.data.vertices),np.float32);o.data.attributes['tree_habitat_core'].data.foreach_get('value',values);data['flower'+str(k)]=values
 np.savez_compressed(masksrc,**data)
vm=np.load(masksrc)
for k,(name,block) in enumerate(grassblocks.items()):
 o=bpy.data.objects[name];roots=coords(o).reshape((-1,block,3))[:,1,:];field=lanes(roots[:,0],roots[:,1]);seed=np.mod(np.sin(roots[:,0]*91.3+roots[:,1]*173.2)*43758.54,1);thin=vm['grass'+str(k)].reshape((-1,2*(block//3-1))).copy();thin|=(seed<field*.99)[:,None];o.data.attributes['tree_habitat_thin'].data.foreach_set('value',thin.ravel())
for k,o in enumerate(sorted([o for o in s.objects if o.name.startswith('Meadow blooms - ')],key=lambda x:x.name)):
 xyz=coords(o);field=lanes(xyz[:,0],xyz[:,1]);core=vm['flower'+str(k)].copy();core[field>.25]=1;o.data.attributes['tree_habitat_core'].data.foreach_set('value',core)
# Weathering at the wall bases is related to wall height and masonry texture.
for name in ['Country coursed local stone','Country warm roughcast limewash','Country pale gray limewash']:
 mt=bpy.data.materials[name].node_tree;bs=next(n for n in mt.nodes if n.type=='BSDF_PRINCIPLED');basecol=bs.inputs['Base Color'].links[0].from_socket;uv=mt.nodes.new('ShaderNodeTexCoord');sep=mt.nodes.new('ShaderNodeSeparateXYZ');mt.links.new(uv.outputs['UV'],sep.inputs[0]);fall=mt.nodes.new('ShaderNodeMapRange');fall.clamp=True;fall.inputs['From Min'].default_value=0;fall.inputs['From Max'].default_value=1.3;fall.inputs['To Min'].default_value=.32;fall.inputs['To Max'].default_value=0;mt.links.new(sep.outputs['Y'],fall.inputs['Value']);mix=mt.nodes.new('ShaderNodeMixRGB');mix.inputs[2].default_value=(.13,.115,.085,1);mt.links.new(fall.outputs[0],mix.inputs[0]);mt.links.new(basecol,mix.inputs[1]);mt.links.new(mix.outputs[0],bs.inputs['Base Color'])
(R/'alpine_identity_lanes.json').write_text(json.dumps({'bounds_xy':bounds,'approach':route,'branches':sidepaths},indent=2))

# Camera view persists in every saved 3D workspace.
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
assert [list(v) for v in c.matrix_world]==json.loads(jfile.read_text())['camera']
report={'mountain_displacement_min_m':float(delta.min()),'mountain_displacement_max_m':float(delta.max()),'changed_vertices':int((abs(delta)>1e-5).sum()),'meadow_y_below_268_unchanged':bool(np.array_equal(new[y<268],a[y<268])),'buildings':buildings,'camera_unchanged':True,'water_unchanged_this_pass':True}
(R/'alpine_identity_report.json').write_text(json.dumps(report,indent=2));bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
saved=(s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.render.use_border,s.render.use_crop_to_border)
s.cycles.device='GPU';s.cycles.samples=160;s.cycles.use_denoising=True;s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100;s.render.use_border=False;s.render.filepath=str(R/'alpine_identity_preview.png');bpy.ops.render.render(write_still=True)
s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.render.use_border,s.render.use_crop_to_border=saved;bpy.ops.wm.save_as_mainfile(filepath=str(FILE));print('ALPINE IDENTITY RENDER COMPLETE',json.dumps(report),flush=True)
