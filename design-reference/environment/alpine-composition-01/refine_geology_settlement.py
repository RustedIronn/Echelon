"""Face geology, natural bank composition and countryside hamlet, in place."""
import bpy,numpy as np,json,sys,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parent;sys.path.insert(0,str(ROOT))
from habitat_structure_fields import HabitatStructure,noise2,smooth
from countryside_architecture import build_settlement
FILE=ROOT/'echelon_alpine_composition_01.blend';bpy.ops.wm.open_mainfile(filepath=str(FILE));s=bpy.context.scene;camera=s.camera
G='Continuous meadow foothills and mountain range';W='Water inside carved channel - static graded surface';GRASSES={'Foreground arching grass':18,'Low basal meadow foliage':18,'Midground meadow continuation':12,'Meadow to foothill transition':12}
old=ROOT/'habitat_structure_source.npz';sections_source=np.load(old);fields=HabitatStructure([sections_source['sections0'],sections_source['sections1']])
def coords(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
def attr(o,name,values,domain='POINT',kind='FLOAT'):
 at=o.data.attributes.get(name)
 if at is None:at=o.data.attributes.new(name,kind,domain)
 at.data.foreach_set('value',np.asarray(values).ravel())
def digest(a):return hashlib.sha256(a.tobytes()).hexdigest()
archive=ROOT/'country_geology_source.npz';metadata=ROOT/'country_geology_source.json'
if not archive.exists():
 data={};meta={'objects':{},'meshes':{},'camera':{'name':camera.name,'matrix':[list(v) for v in camera.matrix_world],'lens':camera.data.lens},'buildings':[]}
 for o in s.objects:
  meta['objects'][o.name]={'matrix':[list(v) for v in o.matrix_world],'hidden':o.hide_get(),'render_hidden':o.hide_render,'scale':list(o.scale)}
 for i,name in enumerate([G,W]+list(GRASSES)+[o.name for o in s.objects if o.name.startswith('Meadow blooms - ')]):
  o=bpy.data.objects[name];key='m'+str(i);data[key]=coords(o);row={'key':key,'attributes':{}}
  for at in o.data.attributes:
   if at.name in ['streambed','damp_soil','alpine_snow','alpine_rock','tree_habitat_z','tree_habitat_core','tree_habitat_thin']:
    v=np.empty(len(at.data),np.bool_ if at.data_type=='BOOLEAN' else np.float32);at.data.foreach_get('value',v);ak=key+'_'+at.name;data[ak]=v;row['attributes'][at.name]={'key':ak,'domain':at.domain,'kind':at.data_type}
  meta['meshes'][name]=row
 for k in range(1,6):
  wall=bpy.data.objects[f'Village {k:02} wall mass'];v=[wall.matrix_world@p.co for p in wall.data.vertices];ax=(v[1]-v[0]).normalized();ay=(v[3]-v[0]).normalized();door=bpy.data.objects[f'Village {k:02} '+('chapel entry' if k==1 else 'front door')];p=sum([door.matrix_world@v.co for v in door.data.vertices],Vector())/len(door.data.vertices);meta['buildings'].append({'door_xy':[p.x,p.y],'ax':list(ax),'ay':list(ay)})
 np.savez_compressed(archive,**data);metadata.write_text(json.dumps(meta,indent=2));print('COUNTRY GEOLOGY SOURCE CAPTURED',flush=True)
meta=json.loads(metadata.read_text());src=np.load(archive)
def original(name):return src[meta['meshes'][name]['key']]
def original_attr(name,at):return src[meta['meshes'][name]['attributes'][at]['key']].copy()
for name,rec in meta['meshes'].items():
 o=bpy.data.objects[name];o.data.vertices.foreach_set('co',original(name).ravel());o.data.update()
 for at,rec_at in rec['attributes'].items():o.data.attributes[at].data.foreach_set('value',src[rec_at['key']])
bpy.context.view_layer.update();g=bpy.data.objects[G];source_bvh=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get());a=original(G)
# Actual terrain horizon, to exclude a generous margin around the approved skyline.
frame=camera.data.view_frame(scene=s);fx0=min(p.x/-p.z for p in frame);fx1=max(p.x/-p.z for p in frame);fy0=min(p.y/-p.z for p in frame);fy1=max(p.y/-p.z for p in frame)
us=np.linspace(0,1,401);vs=[]
for u in us:
 lo=.30;hi=.84
 for step in range(21):
  v=(lo+hi)/2;direction=(camera.matrix_world.to_3x3()@Vector((fx0+(fx1-fx0)*u,fy0+(fy1-fy0)*v,-1))).normalized();p,n,f,d=source_bvh.ray_cast(camera.location,direction,1800)
  if p is None:hi=v
  else:lo=v
 vs.append((lo+hi)/2)
inv=np.array(camera.matrix_world.inverted());cp=a@inv[:3,:3].T+inv[:3,3];depth=-cp[:,2];u=(cp[:,0]/depth-fx0)/(fx1-fx0);v=(cp[:,1]/depth-fy0)/(fy1-fy0);horizon=np.interp(np.clip(u,0,1),us,vs)
protect=smooth((horizon-v-.026)/.026);protect*=((u>=0)&(u<=1)&(depth>0))
# Unequal jointed rock domains, with quieter faces between the main formations.
x,y,z=a.T
geology=np.maximum.reduce([.95*np.exp(-((x+100)/47)**2-((y-366)/48)**2),.72*np.exp(-((x-16)/39)**2-((y-379)/41)**2),np.exp(-((x-121)/48)**2-((y-389)/44)**2)])
# Elongated, irregular joint cells follow the descending slope character.
gx=x/5.5;gy=(y+.12*x)/11;ix=np.floor(gx);iy=np.floor(gy);best=np.full(len(a),1e5);second=best.copy()
for dy in [-1,0,1]:
 for dx in [-1,0,1]:
  cx=ix+dx;cy=iy+dy;jx=np.mod(np.sin(cx*127.1+cy*311.7+4.7)*43758.54,1);jy=np.mod(np.sin(cx*269.5+cy*183.3+7.1)*43758.54,1);distance=np.sqrt((gx-cx-jx)**2+(gy-cy-jy)**2);take=distance<best;second=np.where(take,best,np.minimum(second,distance));best=np.minimum(best,distance)
joints=np.exp(-np.maximum(0,second-best)/.105);drain=np.empty(len(a),np.float32);incision=drain.copy();g.data.attributes['mountain_drainage'].data.foreach_get('value',drain);g.data.attributes['mountain_incision'].data.foreach_get('value',incision)
mountain_mask=geology*protect*smooth((y-280)/35)*smooth((z-24)/17)
rock_mask=original_attr(G,'alpine_rock');mountain_mask*=.45+.55*smooth(rock_mask/.7)
geodelta=mountain_mask*np.clip(-1.85*joints+.55*(noise2(x,y,8,29)-.35)-.48*drain-.38*incision,-2.35,.65)
# Banks gain interlocking turf edges while the carved land and water move together.
def bank_warp(x,y):
 distance,level,side,which=fields.bank(x,y);n=(noise2(y,side*5,3.8,17)-.5)*.46+(noise2(y,side*3,1.9,32)-.5)*.10
 return (n*np.exp(-(np.abs(distance)/3.5)**4)*smooth((y+8)/7)*(1-smooth((y-165)/35))).astype(np.float32)
def turf(x,y):
 d,lev,side,which=fields.bank(x,y);return smooth((noise2(x,y,2.2,13)-.36)/.32)*np.exp(-((d-.38)/.95)**2)*smooth((y+8)/7)*(1-smooth((y-160)/35))
# One modest approach track and branches to the preserved entrance locations.
paths0=json.loads((ROOT/'cohesion_source.json').read_text())['paths']
thresholds=[]
for rec in meta['buildings']:
 thresholds.append((np.array(rec['door_xy'])-.26*np.array(rec['ay'][:2])).tolist())
paths0[0][0]=thresholds[0];paths0[0][-1]=thresholds[1];paths0[1][-1]=thresholds[3];paths0[2][-1]=thresholds[2];paths0[3][-1]=thresholds[4]
# Author the approach on the terrain actually seen below the hamlet, rather than
# hiding most of its old world-space route behind the convex settlement slope.
approach=[]
for screen_u,screen_v in [(.845,.342),(.825,.367),(.805,.387),(.780,.408),(.752,.427),(.737,.439)]:
 direction=(camera.matrix_world.to_3x3()@Vector((fx0+(fx1-fx0)*screen_u,fy0+(fy1-fy0)*screen_v,-1))).normalized();point,*_=source_bvh.ray_cast(camera.location,direction,1800);assert point is not None;approach.append([point.x,point.y])
approach.append(thresholds[0]);routes=[approach]+paths0

def wear_field(x,y):
 out=np.zeros_like(x,dtype=np.float32);ids=np.flatnonzero((x>18)&(x<66)&(y>30)&(y<153))
 if not len(ids):return out
 xx=x[ids];yy=y[ids];strength=np.zeros(len(ids))
 for k,route in enumerate(routes):
  dist=np.full(len(ids),1e5)
  for aa,bb in zip(route[:-1],route[1:]):
   vx,vy=bb[0]-aa[0],bb[1]-aa[1];t=np.clip(((xx-aa[0])*vx+(yy-aa[1])*vy)/(vx*vx+vy*vy),0,1);dist=np.minimum(dist,np.hypot(xx-aa[0]-t*vx,yy-aa[1]-t*vy))
  width=(.65 if k==0 else .42)+.07*np.sin(xx*.93+yy*.6)+.04*np.sin(yy*1.9)
  strength=np.maximum(strength,(1-smooth((dist-width)/.37))*(.8+.2*noise2(xx,yy,.65,7)))
 strength=np.clip(strength*1.22,0,1);strength*=smooth((yy-32)/9);out[ids]=strength;return out

distance,level,side,which=fields.bank(x,y);growth=turf(x,y);bank_dz=.065*growth*smooth((distance+.12)/.32)
wear=wear_field(x,y);new=a.copy();new[:,0]+=bank_warp(x,y);new[:,2]+=geodelta+bank_dz-.018*wear;g.data.vertices.foreach_set('co',new.ravel());g.data.update()
attr(g,'geological_joint_strength',(joints*mountain_mask).astype(np.float32));bed=original_attr(G,'streambed');bed*=1-.68*growth*(z>level+.06);attr(g,'streambed',bed);attr(g,'damp_soil',original_attr(G,'damp_soil')*(.65+.35*noise2(x,y,2.5,72)))
w=bpy.data.objects[W];water=original(W).copy();water[:,0]+=bank_warp(water[:,0],water[:,1]);w.data.vertices.foreach_set('co',water.ravel());w.data.update()
# Snow and exposure follow the newly shaped faces, not a white horizontal cap.
normal=np.array([vv.normal[:] for vv in g.data.vertices],np.float32);sun=np.array([-400,-300,280],float);sun/=np.linalg.norm(sun);aspect=np.clip(normal@sun,0,1);line=53+5*aspect-8*drain+7*(noise2(x,y,9,6)-.5);snow=smooth((new[:,2]-line)/8)*smooth((normal[:,2]-.40)/.43)
old_snow=original_attr(G,'alpine_snow');attr(g,'alpine_snow',np.clip(old_snow*(1-.45*mountain_mask)+snow*.45*mountain_mask,0,1))
# Replace the wear mask with the connected countryside approach and side paths.
size=1024;xx,yy=np.meshgrid(np.linspace(18,66,size,dtype=np.float32),np.linspace(30,153,size,dtype=np.float32));values=wear_field(xx.ravel(),yy.ravel());rgba=np.ones((size*size,4),np.float32);rgba[:,:3]=values[:,None]
im=bpy.data.images.get('Echelon countryside lane wear') or bpy.data.images.new('Echelon countryside lane wear',width=size,height=size,alpha=True);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(rgba.ravel());im.filepath_raw=str(ROOT/'countryside_lane_wear.png');im.file_format='PNG';im.save();im.pack()
t=bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks'];t.nodes['Cohesion foot traffic'].image=im;t.nodes['Cohesion mask origin'].inputs[1].default_value=(18,30,0);t.nodes['Cohesion mask metres'].inputs[1].default_value=(1/48,1/123,0)
# A compacted local gravel/earth track, distinct from grass without an asphalt strip.
soil=t.nodes['Cohesion trampled soil palette'];soil.inputs[0].default_value=.80
road=t.nodes.get('Country lane daylight palette') or t.nodes.new('ShaderNodeHueSaturation');road.name='Country lane daylight palette';road.inputs['Saturation'].default_value=.72;road.inputs['Value'].default_value=1.38;t.links.new(soil.outputs[0],road.inputs['Color']);t.links.new(road.outputs[0],t.nodes['Cohesion worn village ground'].inputs[2])

# All planted roots follow the actual new triangulated surface.
bpy.context.view_layer.update();target_bvh=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get())
def target_ground(x,y):
 p,n,*_=target_bvh.ray_cast(Vector((float(x),float(y),350)),Vector((0,0,-1)),750);assert p is not None;return p.z

def mapped_roots(a):
 out=a.copy();out[:,0]+=bank_warp(a[:,0],a[:,1]);dz=np.zeros(len(a),np.float32)
 for i in np.flatnonzero((a[:,1]>-14)&(a[:,1]<220)):
  oldp,*_=source_bvh.ray_cast(Vector((float(a[i,0]),float(a[i,1]),350)),Vector((0,0,-1)),750);dz[i]=target_ground(out[i,0],out[i,1])-oldp.z
 out[:,2]+=dz;return out
report={'mountains':{'edited_vertices':int(np.count_nonzero(abs(geodelta)>1e-5)),'minimum_change_m':float(geodelta.min()),'maximum_change_m':float(geodelta.max()),'screen_skyline_safety_margin_fraction':.026},'grass':{},'hamlet':[],'stones':[]}
for name,block in GRASSES.items():
 o=bpy.data.objects[name];base=original(name);chunks=base.reshape((-1,block,3));roots=chunks[:,1,:];mapped=mapped_roots(roots);out=chunks+(mapped-roots)[:,None,:];distance,lev,side,which=fields.bank(roots[:,0],roots[:,1]);cap=turf(roots[:,0],roots[:,1]);path=wear_field(mapped[:,0],mapped[:,1]);rel=chunks-roots[:,None,:]
 # Real overhanging leaf tips from dry rooted turf, plus trampled approach grass.
 hang=.15*cap*(roots[:,2]>lev+.08);progress=np.repeat(np.linspace(0,1,block//3),3);out[:,:,0]+=-side[:,None]*hang[:,None]*progress[None,:]**1.6;out[:,:,2]+=-.08*cap[:,None]*progress[None,:]**2-rel[:,:,2]*path[:,None]*.87
 o.data.vertices.foreach_set('co',out.astype(np.float32).ravel());o.data.update();seed=np.mod(np.sin(roots[:,0]*91.3+roots[:,1]*173.2)*43758.54,1);thin=original_attr(name,'tree_habitat_thin').reshape((-1,2*(block//3-1)));thin|=(seed<path*.94)[:,None];attr(o,'tree_habitat_thin',thin.ravel(),domain='FACE',kind='BOOLEAN');print('ROOTED',name,flush=True)
 report['grass'][name]={'retained_blades':len(roots),'path_affected':int((path>.1).sum())}
for name in meta['meshes']:
 if not name.startswith('Meadow blooms - '):continue
 o=bpy.data.objects[name];base=original(name);out=mapped_roots(base);o.data.vertices.foreach_set('co',out.ravel());o.data.update();path=wear_field(out[:,0],out[:,1]);core=original_attr(name,'tree_habitat_core');core[path>.50]=1;attr(o,'tree_habitat_core',core)
# Keep the earlier architecture as hidden source objects, never mixed with the new roofs.
for o in s.objects:
 if o.name.startswith('Village '):o.hide_render=True;o.hide_set(True)
col=bpy.data.collections.get('11 Countryside hamlet - vernacular buildings')
if col:
 for o in list(col.all_objects):bpy.data.objects.remove(o,do_unlink=True)
 for child in list(col.children):bpy.data.collections.remove(child)
else:col=bpy.data.collections.new('11 Countryside hamlet - vernacular buildings');s.collection.children.link(col)
report['hamlet']=build_settlement(meta['buildings'],col,target_ground)
# Rock placement uses a few irregular groups, not one specimen per bank interval.
prototypes=[bpy.data.objects[f'SOURCE - habitat limestone {i}'] for i in range(1,5)]
def shore(k,y,side,offset):
 yy,c,left,right,z,f=sections_source['sections'+str(k)].T;x=float(np.interp(y,yy,left if side<0 else right))+side*offset*float(np.interp(y,yy,f));x+=float(bank_warp(np.array([x]),np.array([y]))[0]);return x,y
# Existing river anchors remain readable, with the two least useful isolated ones held back.
for name in ['Embedded limestone anchor 03','Embedded limestone anchor 05']:
 o=bpy.data.objects.get(name)
 if o:o.hide_render=True;o.hide_set(True)
anchors=[('Embedded limestone anchor 01',0,7,-1,.05,.67),('Embedded limestone anchor 02',0,17,1,-.20,.72),('Embedded limestone anchor 04',1,74,-1,-.05,.45)]
for name,k,y,side,offset,size in anchors:
 o=bpy.data.objects[name];x,y=shore(k,y,side,offset);o.location=(x,y,target_ground(x,y)+size*.045);o.scale=(size,)*3;report['stones'].append({'name':name,'position':list(o.location),'scale':size})
small=[(0,6.3,-1,-.20,.19),(0,8.6,-1,.30,.26),(0,9.2,-1,-.32,.14),(0,16.2,1,-.34,.22),(0,18.8,1,.25,.16),(0,20.2,1,-.15,.13),(1,72.7,-1,.15,.19),(1,75.3,-1,-.20,.14),(1,76.2,-1,.28,.12),(0,24,-1,.08,.18)]
for i,(k,y,side,offset,size) in enumerate(small):
 o=bpy.data.objects[f'Bank limestone {i+1:02}'];o.data=prototypes[i%4].data;x,y=shore(k,y,side,offset);o.location=(x,y,target_ground(x,y)+size*.03);o.scale=(size,)*3;o.rotation_euler=(.12*math.sin(i),.14*math.cos(i),i*1.79)
# Existing editable sediment points follow the small bank deformation.
emitter=bpy.data.objects['Fluvial pebbles - three restrained sediment pockets']
# This emitter source is saved separately to avoid accumulating shifts on reruns.
pebfile=ROOT/'country_original_pebble_points.npy'
if not pebfile.exists():np.save(pebfile,coords(emitter))
a= np.load(pebfile);out=mapped_roots(a);emitter.data.vertices.foreach_set('co',out.ravel());emitter.data.update()
assert [list(v) for v in camera.matrix_world]==meta['camera']['matrix'] and camera.data.lens==meta['camera']['lens']
(ROOT/'country_geology_report.json').write_text(json.dumps(report,indent=2));bpy.context.preferences.filepaths.save_version=0;bpy.context.view_layer.objects.active=camera;bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
saved=(s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.cycles.use_denoising)
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=160;s.cycles.use_denoising=True;s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100;s.render.filepath=str(ROOT/'country_geology_preview.png');bpy.ops.render.render(write_still=True)
s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.cycles.use_denoising=saved;bpy.ops.wm.save_as_mainfile(filepath=str(FILE));print('COUNTRY GEOLOGY HERO COMPLETE',json.dumps(report),flush=True)
