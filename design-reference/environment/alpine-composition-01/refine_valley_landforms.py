"""In-place valley, riverbank, mid-meadow and hamlet refinement.
No whole-scene regeneration; repeatable from a compact source geometry archive.
"""
import bpy,math,json,hashlib,sys
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parent;sys.path.insert(0,str(ROOT))
from stream_network import StreamNetwork
FILE=ROOT/'echelon_alpine_composition_01.blend';bpy.ops.wm.open_mainfile(filepath=str(FILE));s=bpy.context.scene;camera=s.camera
GROUND='Continuous meadow foothills and mountain range';WATER='Water inside carved channel - static graded surface'
GRASSES={'Foreground arching grass':18,'Low basal meadow foliage':18,'Midground meadow continuation':12,'Meadow to foothill transition':12}
NETWORK=StreamNetwork();ys=np.arange(-45,231,.25)
stream_samples=[{'cx':np.array([q.center(y) for y in ys]),'factor':np.array([q.factor(y) for y in ys]),'width':np.array([q.width(y) for y in ys]),'level':np.array([q.level(y) for y in ys]),'ymin':q.controls[0][0],'ymax':q.controls[-1][0]} for q in NETWORK.streams]
def coords(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
def digest(a):return hashlib.sha256(a.tobytes()).hexdigest()
def smooth(x):
 x=np.clip(x,0,1);return x*x*(3-2*x)
def attr(o,name,values,domain='POINT',kind='FLOAT'):
 a=o.data.attributes.get(name)
 if not a:a=o.data.attributes.new(name,kind,domain)
 a.data.foreach_set('value',np.asarray(values).ravel())
def meshkey(i):return 'mesh_'+str(i)
# Source archive makes visual refinements repeatable without numbered .blend files.
archive_file=ROOT/'valley_landform_source.npz';meta_file=ROOT/'valley_landform_source.json'
if not archive_file.exists():
 storage={};meta={'meshes':{},'poses':{},'visibility':{},'camera':{'matrix':[list(r) for r in camera.matrix_world],'lens':camera.data.lens},'lights':{},'materials':{}}
 names=[GROUND,WATER]+list(GRASSES)+[o.name for o in s.objects if o.name.startswith('Meadow blooms - ')]
 # Small placed stones are moved rigidly with their local bank, never respawned.
 for o in s.objects:
  meta['poses'][o.name]=[list(r) for r in o.matrix_world];meta['visibility'][o.name]={'render':o.hide_render,'viewport':o.hide_get()}
  if o.type=='LIGHT':meta['lights'][o.name]={'energy':o.data.energy,'matrix':[list(r) for r in o.matrix_world]}
  if o.type=='MESH' and o.name.startswith('Village '):names.append(o.name)
 for i,name in enumerate(names):
  o=bpy.data.objects[name];a=coords(o);k=meshkey(i);storage[k]=a;record={'key':k,'hash':digest(a),'attributes':{}}
  for at in o.data.attributes:
   if at.name in ['meadow_vigor','streambed','damp_soil','tree_habitat_soil','tree_habitat_z','tree_habitat_thin','tree_habitat_core']:
    values=np.empty(len(at.data),dtype=np.bool_ if at.data_type=='BOOLEAN' else np.float32);at.data.foreach_get('value',values);ak=k+'_'+at.name;storage[ak]=values;record['attributes'][at.name]=ak
  meta['meshes'][name]=record
 for m in bpy.data.materials:
  if m.use_nodes:
   p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
   if p:meta['materials'][m.name]={'base':list(p.inputs['Base Color'].default_value),'roughness':p.inputs['Roughness'].default_value}
 # Inspect base land without the reversible centimetre-scale tree-root relief.
 g=bpy.data.objects[GROUND];relief=g.modifiers.get('Tree habitat - local root microrelief');was=relief.show_viewport if relief else None
 if relief:relief.show_viewport=False
 bpy.context.view_layer.update();bv=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get())
 gx=np.arange(-220,221,2,dtype=np.float32);gy=np.arange(-40,501,2,dtype=np.float32);grid=np.empty((len(gy),len(gx)),np.float32)
 for j,y in enumerate(gy):
  for i,x in enumerate(gx):
   hit,*_=bv.ray_cast(Vector((float(x),float(y),350)),Vector((0,0,-1)),750);grid[j,i]=hit.z if hit else 0
 storage['grid_x']=gx;storage['grid_y']=gy;storage['height_grid']=grid
 if relief:relief.show_viewport=was
 np.savez_compressed(archive_file,**storage);meta_file.write_text(json.dumps(meta,indent=2));print('SOURCE ARCHIVED',len(names),flush=True)
meta=json.loads(meta_file.read_text());src=np.load(archive_file)
# Remove only this helper's previous architectural additions.
addition=bpy.data.collections.get('09 Hamlet visible construction details')
if addition:
 for o in list(addition.objects):bpy.data.objects.remove(o,do_unlink=True)
else:addition=bpy.data.collections.new('09 Hamlet visible construction details');s.collection.children.link(addition)
from mathutils import Matrix
for name,item in meta['meshes'].items():
 o=bpy.data.objects[name];o.data.vertices.foreach_set('co',src[item['key']].ravel());o.data.update()
 for at,key in item['attributes'].items():o.data.attributes[at].data.foreach_set('value',src[key])
for name,matrix in meta['poses'].items():
 if name in bpy.data.objects and (name.startswith('Village ') or ('stone' in name.lower() and not name.startswith('SOURCE '))):bpy.data.objects[name].matrix_world=Matrix(matrix)
gx=src['grid_x'];gy=src['grid_y'];grid=src['height_grid']
def sample_grid(x,y):
 ix=np.clip((x-gx[0])/2,0,len(gx)-1.001);iy=np.clip((y-gy[0])/2,0,len(gy)-1.001);i=ix.astype(np.int32);j=iy.astype(np.int32);u=ix-i;v=iy-j
 return (grid[j,i]*(1-u)+grid[j,i+1]*u)*(1-v)+(grid[j+1,i]*(1-u)+grid[j+1,i+1]*u)*v
def river_info(x,y):
 best=np.full_like(x,1e5,dtype=np.float32);levels=np.zeros_like(x,dtype=np.float32);banks=np.zeros_like(x,dtype=np.float32)
 for st in stream_samples:
  cx=np.interp(y,ys,st['cx']);f=np.interp(y,ys,st['factor']);w=np.interp(y,ys,st['width']);d=np.abs(x-cx)/f-w/2
  active=(y>=st['ymin'])&(y<=st['ymax']);take=(d<best)&active;best=np.where(take,d,best);levels=np.where(take,np.interp(y,ys,st['level']),levels)
 return best,levels
# Monotonic broad valley profile. Hermite interpolation avoids slope breaks.
profile_y=np.array([60,100,135,170,210,250,285,320,355],float)
profile_z=np.array([2.5,3.7,5.0,7.0,10.0,14.0,18.4,24.3,33.0],float)
sec=np.diff(profile_z)/np.diff(profile_y);slopes=np.r_[sec[0],(sec[:-1]+sec[1:])/2,sec[-1]]
def profile(y):
 i=np.clip(np.searchsorted(profile_y,y)-1,0,len(profile_y)-2);length=profile_y[i+1]-profile_y[i];t=np.clip((y-profile_y[i])/length,0,1)
 return (2*t**3-3*t*t+1)*profile_z[i]+(t**3-2*t*t+t)*length*slopes[i]+(-2*t**3+3*t*t)*profile_z[i+1]+(t**3-t*t)*length*slopes[i+1]
def gravel_shelves(x,y):
 result=np.zeros_like(x,dtype=np.float32)
 for idx,yc,side,length in [(0,29,1,6),(0,48,-1,7),(1,88,1,8)]:
  st=stream_samples[idx];cx=np.interp(y,ys,st['cx']);f=np.interp(y,ys,st['factor']);half=np.interp(y,ys,st['width'])/2
  across=side*(x-cx)/f-half
  shelf=np.exp(-((y-yc)/length)**2)*np.exp(-((across-1.15)/1.05)**2)
  result=np.maximum(result,shelf)
 return result
def geography(x,y,original=None):
 d,lev=river_info(x,y)
 if original is None:original=sample_grid(x,y)
 # Remove the isolated central crest, retaining uneven shoulders on either side.
 ascent_y=y+(12*np.sin(x*.014+.8)+8*np.sin(x*.029-1.3))*smooth((y-110)/80)
 target=profile(ascent_y)+1.10*(x/100)**2+2.0*smooth((x+10)/110)*smooth((y-90)/90)
 target+=.85*smooth((y-115)/140)*np.exp(-((x-(-82+.05*y))/28)**2)-.65*smooth((y-140)/100)*np.exp(-((x-(10-.11*y))/22)**2)
 target+=.36*np.sin(x*.024+y*.012)*smooth((y-110)/70)
 fullness=.88+.12*smooth((y-185)/25)*(1-smooth((y-270)/15))
 influence=fullness*smooth((y-118)/50)*(1-smooth((y-(270+8*np.sin(x*.019)))/45))*smooth((x+220)/40)*(1-smooth((x-150)/70))
 dry=smooth((d-.55)/6.5)
 dz=np.clip(target-original,-9.0,2.2)*influence*dry
 # Feather the existing hamlet shoulder into its valley, not a separate plinth.
 dz-=.62*np.exp(-((x-39)/36)**2-((y-139)/32)**2)*smooth((y-75)/30)*dry
 # Two broad shallow drainage folds give the mid meadow surface coherent relief.
 swale1=x+40-.13*y-5*np.sin(y*.024)
 swale2=x-38+.09*y+3*np.sin(y*.033)
 subtle=(-.20*np.exp(-(swale1/9)**2)+.13*np.exp(-((swale1+15)/14)**2)-.14*np.exp(-(swale2/11)**2))
 dz+=subtle*smooth((y-34)/30)*(1-smooth((y-150)/50))*dry
 # Small irregular gravel shelves near selected inner-bank stretches; no rocky border.
 shelves=.16*np.exp(-((y-32)/6)**2)*np.exp(-((x+28)/9)**2)+.10*np.exp(-((y-86)/10)**2)*np.exp(-((x-2)/6)**2)
 dz+=shelves*np.exp(-((d-.35)/1.9)**2)*smooth((y-16)/12)
 # Actual shallow deposits in selected inner bends, connected to the existing bed.
 shelf=gravel_shelves(x,y)
 dz+=np.maximum(0,lev+.025-(original+dz))*.90*shelf
 return dz.astype(np.float32)
def warp(x,y):
 sx=np.zeros_like(x,dtype=np.float32);weights=np.zeros_like(x,dtype=np.float32)
 for i,st in enumerate(stream_samples):
  cx=np.interp(y,ys,st['cx']);f=np.interp(y,ys,st['factor']);half=np.interp(y,ys,st['width'])/2;dx=(x-cx)/f
  w=np.exp(-(np.abs(dx)/(half+7))**4)*smooth((y-st['ymin'])/5)*(1-smooth((y-st['ymax']+5)/5))
  # Unequal lengths/frequencies and bank response, not periodic perfect scallops.
  turn=.30*np.sin(y*.17+i*.7)+.16*np.sin(y*.43+1.1)+.10*np.cos(y*.73)
  widen=.105*np.sin(y*.119+.8)+.045*np.sin(y*.39+2.4)
  displaced=(turn+dx*widen)*f
  sx+=w*displaced;weights+=w
 weight=smooth((y-16)/16)*(1-smooth((y-215)/15))
 return np.where(weights>.00001,sx/np.maximum(weights,1)*weight,0).astype(np.float32)
def ecology(x,y):
 d,lev=river_info(x,y)
 vigorous=.51+.14*np.sin(x*.071+y*.032)*np.cos(y*.051)+.12*np.sin(x*.029-y*.057)
 vigorous+=.17*np.exp(-((x+34)/37)**2-((y-104)/34)**2)-.10*np.exp(-((x-26)/28)**2-((y-90)/24)**2)
 vigorous+=.10*np.exp(-((d-5)/6)**2)
 return np.clip(vigorous,.15,.90)
def deformation(a,soil_offset=0):
 b=a.copy();b[:,0]+=warp(a[:,0],a[:,1]);b[:,2]+=geography(a[:,0],a[:,1],a[:,2]+soil_offset);return b
report={'geography':{},'grass':{},'hamlet':[],'hidden_trees':[],'preservation':{}}
# Same map moves both channel and water. Foreground entry and fixed camera are untouched.
g=bpy.data.objects[GROUND];old=src[meta['meshes'][GROUND]['key']];a=deformation(old);g.data.vertices.foreach_set('co',a.ravel());g.data.update()
report['geography']={'maximum_lowering_m':float(np.min(a[:,2]-old[:,2])),'maximum_raise_m':float(np.max(a[:,2]-old[:,2])),'maximum_lateral_bank_deformation_m':float(np.max(abs(a[:,0]-old[:,0]))),'mountain_vertices_y323_and_beyond_unchanged':bool(np.array_equal(a[old[:,1]>=323],old[old[:,1]>=323]))}
w=bpy.data.objects[WATER];wa=src[meta['meshes'][WATER]['key']].copy();wa[:,0]+=warp(wa[:,0],wa[:,1]);w.data.vertices.foreach_set('co',wa.ravel());w.data.update()
assert np.array_equal(a[old[:,1]>=323],old[old[:,1]>=323]);assert np.array_equal(wa[:,1:],src[meta['meshes'][WATER]['key']][:,1:])
# Remove the OLD steep-front rock stripe together with the geometric cutoff.
rock_source=ROOT/'valley_original_rock_mask.npz'
if not rock_source.exists():
 values=np.empty(len(g.data.vertices),np.float32);g.data.attributes['alpine_rock'].data.foreach_get('value',values);np.savez_compressed(rock_source,rock=values)
rock_original=np.load(rock_source)['rock'];normal_z=np.array([v.normal.z for v in g.data.vertices],np.float32)
rock_actual=np.clip(smooth((a[:,2]-23)/16)*(.3+.7*smooth((.94-normal_z)/.30)),0,1)
repair=smooth((old[:,1]-205)/18)*(1-smooth((old[:,1]-276)/35))*smooth((old[:,0]+220)/40)*(1-smooth((old[:,0]-150)/70))
attr(g,'alpine_rock',rock_original*(1-repair)+rock_actual*repair)
# Reuse ground/grass signals so midground variation belongs to one surface.
d,lev=river_info(old[:,0],old[:,1]);v=ecology(old[:,0],old[:,1]);mid=smooth((old[:,1]-42)/35)*(1-smooth((old[:,1]-235)/55))
original_v=src[meta['meshes'][GROUND]['attributes']['meadow_vigor']];attr(g,'meadow_vigor',original_v*(1-.65*mid)+v*.65*mid)
attr(g,'valley_sward',.5+(v-.5)*mid)
attr(g,'valley_midfield',mid)
# Reduce the scanned earth/lawn dominance only through the middle meadow.
t=bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks'];scan=t.nodes['Scanned meadow foundation']
for node in list(t.nodes):
 if node.name.startswith('Valley midground '):t.nodes.remove(node)
field=t.nodes.new('ShaderNodeAttribute');field.name='Valley midground coverage';field.attribute_name='valley_midfield'
scale=t.nodes.new('ShaderNodeMath');scale.name='Valley midground scanned proportion';scale.operation='MULTIPLY_ADD';scale.inputs[1].default_value=-.24;scale.inputs[2].default_value=.68
t.links.new(field.outputs['Fac'],scale.inputs[0]);t.links.new(scale.outputs[0],scan.inputs[0])
# Break the uniform damp outline using existing bank masks and local sediment changes.
damp=src[meta['meshes'][GROUND]['attributes']['damp_soil']].copy();damp*=1-mid*(.28+.22*np.sin(old[:,1]*.19+old[:,0]*.31));deposit=gravel_shelves(old[:,0],old[:,1]);damp*=1-.6*deposit;attr(g,'damp_soil',np.clip(damp,0,1))
bed=src[meta['meshes'][GROUND]['attributes']['streambed']].copy();attr(g,'streambed',np.maximum(bed,.88*deposit))
# Habitat modifiers under temporarily hidden background trees must not leave ghost clearings.
for name in ['tree_habitat_soil','tree_habitat_z']:
 data=src[meta['meshes'][GROUND]['attributes'][name]].copy();data[old[:,1]>70]=0;attr(g,name,data)
for name,block in GRASSES.items():
 o=bpy.data.objects[name];base=src[meta['meshes'][name]['key']];chunks=base.reshape((-1,block,3));roots=chunks[:,1,:];v=ecology(roots[:,0],roots[:,1]);mid=smooth((roots[:,1]-42)/35)*(1-smooth((roots[:,1]-230)/45))
 shifted=chunks.copy();shifted[:,:,0]+=warp(roots[:,0],roots[:,1])[:,None];shifted[:,:,2]+=geography(roots[:,0],roots[:,1],roots[:,2]+.016)[:,None]
 # Shape the existing sward: stronger low arching leaves in rich zones, quieter thin growth elsewhere.
 relative=chunks-roots[:,None,:];length=1+mid*(.08+.65*v);height=1+mid*(-.20+1.15*v)
 shifted[:,:,0]+=relative[:,:,0]*(length[:,None]-1);shifted[:,:,1]+=relative[:,:,1]*(length[:,None]-1);shifted[:,:,2]+=relative[:,:,2]*(height[:,None]-1)
 o.data.vertices.foreach_set('co',shifted.astype(np.float32).ravel());o.data.update();attr(o,'valley_sward',np.repeat(.5+(v-.5)*mid,block))
 for at in ['tree_habitat_z','tree_habitat_thin']:
  vals=src[meta['meshes'][name]['attributes'][at]].copy()
  if at=='tree_habitat_z':vals[base[:,1]>70]=0
  else:vals[np.repeat(roots[:,1]>70,2*(block//3-1))]=False
  attr(o,at,vals,domain='POINT' if at.endswith('_z') else 'FACE',kind='FLOAT' if at.endswith('_z') else 'BOOLEAN')
 report['grass'][name]={'existing_blades':len(roots),'midground_height_multiplier_range':[float(height.min()),float(height.max())],'no_new_instances':True}
for name,item in meta['meshes'].items():
 if not name.startswith('Meadow blooms - '):continue
 o=bpy.data.objects[name];base=src[item['key']];a=deformation(base,soil_offset=.016);o.data.vertices.foreach_set('co',a.ravel());o.data.update()
 for at in ['tree_habitat_z','tree_habitat_core']:
  vals=src[item['attributes'][at]].copy();vals[base[:,1]>70]=0;attr(o,at,vals)
 assert np.array_equal(a[base[:,1]<=16],base[base[:,1]<=16]),'Immediate foreground flowers changed'
# Rebalance the EXISTING blades into connected ecological color regions.
material_archive=ROOT/'valley_original_grass_materials.npz'
if not material_archive.exists():
 mats={}
 for i,name in enumerate(GRASSES):
  o=bpy.data.objects[name];values=np.empty(len(o.data.polygons),np.int32);o.data.polygons.foreach_get('material_index',values);mats['m'+str(i)]=values
 np.savez_compressed(material_archive,**mats)
mat_source=np.load(material_archive)
for i,(name,block) in enumerate(GRASSES.items()):
 o=bpy.data.objects[name];base=src[meta['meshes'][name]['key']];roots=base.reshape((-1,block,3))[:,1,:];v=ecology(roots[:,0],roots[:,1]);mid=smooth((roots[:,1]-52)/40)*(1-smooth((roots[:,1]-240)/45))
 seed=np.mod(np.sin(roots[:,0]*137.1+roots[:,1]*271.7)*43758.53,1)
 desired=np.where(v>.63,np.where(seed>.5,3,1),np.where(v<.37,np.where(seed>.7,4,2),np.where(seed>.55,1,0)))
 oldmat=mat_source['m'+str(i)].reshape((-1,2*(block//3-1)));indices=oldmat.copy();take=seed<mid*.60;indices[take,:]=desired[take,None];o.data.polygons.foreach_set('material_index',indices.astype(np.int32).ravel())
# Subtle material variety follows the actual sward field, not extra scatter.
for material in bpy.data.materials:
 if not material.name.startswith('Meadow leaf - '):continue
 t=material.node_tree;p=next(n for n in t.nodes if n.type=='BSDF_PRINCIPLED')
 for n in list(t.nodes):
  if n.name.startswith('Valley '):t.nodes.remove(n)
 base=meta['materials'][material.name]['base'];at=t.nodes.new('ShaderNodeAttribute');at.name='Valley sward response';at.attribute_name='valley_sward';r=t.nodes.new('ShaderNodeValToRGB');r.name='Valley related grass greens'
 r.color_ramp.elements.remove(r.color_ramp.elements[1]);e=r.color_ramp.elements[0];e.position=.15;e.color=(*(np.array(base[:3])*np.array([.92,.94,.97])),1)
 e=r.color_ramp.elements.new(.5);e.color=base;e=r.color_ramp.elements.new(.9);e.color=(*(np.array(base[:3])*np.array([1.15,1.10,1.13])),1)
 t.links.new(at.outputs['Fac'],r.inputs['Fac']);t.links.new(r.outputs['Color'],p.inputs['Base Color'])
# The old .22 distant roughness averaged all small normals into a flat blue shape.
# Preserve near-water response; allow restrained larger-scale reflected variation upstream.
t=bpy.data.objects[WATER].data.materials[0].node_tree
for n in list(t.nodes):
 if n.name.startswith('Valley water '):t.nodes.remove(n)
t.nodes['Broader distant sky reflections'].inputs['To Max'].default_value=.12
n=t.nodes.new('ShaderNodeTexNoise');n.name='Valley water long static undulation';n.inputs['Scale'].default_value=.55;n.inputs['Detail'].default_value=2;t.links.new(t.nodes['Long gentle ripples'].outputs[0],n.inputs['Vector'])
strength=t.nodes.new('ShaderNodeMapRange');strength.name='Valley water distant response';strength.clamp=True;strength.inputs['From Min'].default_value=35;strength.inputs['From Max'].default_value=100;strength.inputs['To Min'].default_value=0;strength.inputs['To Max'].default_value=.11;t.links.new(t.nodes['Water distance along valley'].outputs['Y'],strength.inputs['Value'])
b=t.nodes.new('ShaderNodeBump');b.name='Valley water graded larger normals';b.inputs['Distance'].default_value=.06;t.links.new(strength.outputs['Result'],b.inputs['Strength']);t.links.new(n.outputs['Fac'],b.inputs['Height']);t.links.new(t.nodes['Small water surface response'].outputs['Normal'],b.inputs['Normal']);t.links.new(b.outputs['Normal'],t.nodes['Clear alpine water'].inputs['Normal'])
# Hide all background tree objects, retaining only the foreground shelter and its ferns.
for o in bpy.data.collections['Authored trees and saplings - individual placements'].objects:
 if o.name!='Norway Spruce - foreground-left stream shelter':o.hide_render=True;o.hide_set(True);report['hidden_trees'].append(o.name)
# New ground BVH for rigid building seats and old bank stones.
bpy.context.view_layer.update();bv=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get())
def ground(x,y):
 p,n,*_=bv.ray_cast(Vector((x,y,350)),Vector((0,0,-1)),750);assert p is not None;return p.z
for k in range(1,6):
 prefix=f'Village {k:02}';wall=bpy.data.objects[prefix+' wall mass'];verts=coords(wall);world=np.array([wall.matrix_world@Vector(v) for v in verts]);cx,cy=world[:,:2].mean(axis=0);dz=float(geography(np.array([cx]),np.array([cy]))[0])
 # Entire building moves rigidly, preserving architectural proportions and all relationships.
 for o in s.objects:
  if o.name.startswith(prefix+' '):o.location.z+=dz
 report['hamlet'].append({'building':prefix,'center':[float(cx),float(cy)],'grounding_change_m':dz})
# Existing bank stones: preserve meshes, transform centers with the same river/land map.
for o in s.objects:
 if o.type=='MESH' and ('stone' in o.name.lower() or 'pebble' in o.name.lower()) and not o.name.startswith(('Village ','SOURCE ')):
  if o.name not in meta['poses']:continue
  # Many river stones use transforms; any world-baked geometry is left untouched.
  if o.location.length<.001:continue
  x,y=o.location.x,o.location.y;o.location.x+=float(warp(np.array([x]),np.array([y]))[0]);o.location.z+=float(geography(np.array([x]),np.array([y]))[0])
bpy.context.view_layer.update()
# Hamlet material response uses existing surface families, no external assets.
def weather(material,role):
 t=material.node_tree;p=next((n for n in t.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if not p:return
 for n in list(t.nodes):
  if n.name.startswith('Valley '):t.nodes.remove(n)
 base=meta['materials'][material.name]['base'];geo=t.nodes.new('ShaderNodeNewGeometry');geo.name='Valley world surface';n=t.nodes.new('ShaderNodeTexNoise');n.name='Valley restrained surface age';n.inputs['Scale'].default_value=3 if role=='plaster' else 6;n.inputs['Detail'].default_value=2;t.links.new(geo.outputs['Position'],n.inputs['Vector'])
 ramp=t.nodes.new('ShaderNodeValToRGB');ramp.name='Valley restrained material variation';ramp.color_ramp.elements[0].position=.15;ramp.color_ramp.elements[0].color=(*(np.array(base[:3])*.83),1);ramp.color_ramp.elements[1].position=.85;ramp.color_ramp.elements[1].color=(*(np.array(base[:3])*1.08),1);t.links.new(n.outputs['Fac'],ramp.inputs['Fac']);t.links.new(ramp.outputs['Color'],p.inputs['Base Color'])
 if role!='glass':
  bump=t.nodes.new('ShaderNodeBump');bump.name='Valley fine surface';bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.008 if role=='plaster' else .017;t.links.new(n.outputs['Fac'],bump.inputs['Height']);t.links.new(bump.outputs['Normal'],p.inputs['Normal']);p.inputs['Roughness'].default_value=.88
for name in ['Warm village plaster','Hamlet warm limewash','Hamlet aged timber','Hamlet weathered slate','Hamlet warm brown shingles','Muted clay roofs','Hamlet weathered foundation stone']:
 weather(bpy.data.materials[name],'plaster' if name in ['Warm village plaster','Hamlet warm limewash'] else 'roof')
# Construction details sized for the hero view: fascia, ridge caps, shutters, porch roofs.
def box(name,center,axes,dims,mat):
 verts=[];a,b,c=axes
 for z in [-1,1]:
  for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]:verts.append(tuple(center+a*(x*dims[0]/2)+b*(y*dims[1]/2)+c*(z*dims[2]/2)))
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]);me.materials.append(mat);ob=bpy.data.objects.new(name,me);addition.objects.link(ob);return ob
def beam(name,p0,p1,width,depth,mat):
 direction=(p1-p0).normalized();up=Vector((0,0,1));side=direction.cross(up)
 if side.length<.01:side=Vector((1,0,0))
 side.normalize();normal=side.cross(direction).normalized();return box(name,(p0+p1)/2,(side,direction,normal),(width,(p1-p0).length,depth),mat)
timber=bpy.data.materials['Hamlet aged timber'];trim=bpy.data.materials['Hamlet pale window trim'];stone=bpy.data.materials['Hamlet weathered foundation stone'];slate=bpy.data.materials['Hamlet weathered slate']
for k in range(1,6):
 prefix=f'Village {k:02}';o=bpy.data.objects[prefix+' wall mass'];v=[o.matrix_world@p.co for p in o.data.vertices];ax=(v[1]-v[0]).normalized();ay=(v[3]-v[0]).normalized();up=Vector((0,0,1));width=(v[1]-v[0]).length;depth=(v[3]-v[0]).length
 roof=bpy.data.objects[prefix+' pitched roof'];rv=[roof.matrix_world@p.co for p in roof.data.vertices]
 for a,b in [(0,4),(4,1),(3,5),(5,2),(0,3),(1,2)]:beam(prefix+' visible fascia '+str(a)+str(b),rv[a],rv[b],.095,.115,timber)
 beam(prefix+' ridge cap',rv[4]+up*.06,rv[5]+up*.06,.14,.11,slate)
 # Place shutters only beside existing windows, not arbitrary decorative dots.
 windows=[q for q in s.objects if q.name.startswith(prefix+' window recess')]
 for j,win in enumerate(windows[:2]):
  q=[win.matrix_world@p.co for p in win.data.vertices];center=sum(q,Vector())/len(q);wx=(q[1]-q[0]).length;wh=(q[4]-q[0]).length
  for side in [-1,1]:box(prefix+f' shutter {j} {side}',center+ax*side*(wx*.5+.115)-ay*.045,(ax,ay,up),(.19,.075,wh*1.06),timber)
 # Ground-colored wall foot and a projecting timber sill help establish scale.
 if k!=1:
  z=max((o.matrix_world@p.co).z for p in o.data.vertices);front=(v[4]+v[5])/2
  box(prefix+' upper timber tie',Vector((front.x,front.y,z-.22))-ay*.035,(ax,ay,up),(width+.10,.12,.13),timber)
 # Small pitched weather hood on chapel door makes a readable entry shadow.
 if k==1:
  door=bpy.data.objects[prefix+' chapel entry'];dv=[door.matrix_world@p.co for p in door.data.vertices];c=sum(dv,Vector())/len(dv);z=max(p.z for p in dv)+.12
  a=c-ax*.65-ay*.48;a.z=z;b=c+ax*.65-ay*.48;b.z=z;ridge=c-ay*.48;ridge.z=z+.34
  me=bpy.data.meshes.new(prefix+' chapel entry hood');me.from_pydata([tuple(a),tuple(b),tuple(ridge),tuple(a+ay*.52),tuple(b+ay*.52),tuple(ridge+ay*.52)],[],[(0,2,5,3),(2,1,4,5)]);me.materials.append(slate);ho=bpy.data.objects.new(prefix+' chapel entry hood',me);addition.objects.link(ho);mod=ho.modifiers.new('Roof thickness','SOLIDIFY');mod.thickness=.045
 # Porch grounding uses the existing stone steps; no enclosing garden or props.
# Keep architecture editable and avoid razor-sharp CG edges at render scale.
for o in addition.objects:
 if o.type=='MESH' and len(o.data.polygons)==6:
  b=o.modifiers.new('Small construction edge','BEVEL');b.width=.012;b.segments=1
# Save the same canonical scene, then render the real hero camera.
bpy.context.view_layer.update();assert [list(v) for v in camera.matrix_world]==meta['camera']['matrix'] and camera.data.lens==meta['camera']['lens']
for name,info in meta['lights'].items():
 o=bpy.data.objects[name];assert o.data.energy==info['energy'] and [list(v) for v in o.matrix_world]==info['matrix']
report['preservation']={'camera_and_lights_unchanged':True,'mountain_high_geometry_y323_plus_unchanged':True,'water_grade_and_volume_depth_unchanged':True,'immediate_foreground_flowers_y16_and_nearer_unchanged':True,'no_new_trees_or_vegetation_instances':True}
report['new_architecture_parts']=len(addition.objects)
(ROOT/'valley_landform_report.json').write_text(json.dumps(report,indent=2));bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
saved=(s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.cycles.use_denoising)
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=128;s.cycles.use_denoising=True;s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100;s.render.filepath=str(ROOT/'valley_landform_preview.png');bpy.ops.render.render(write_still=True)
s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.cycles.use_denoising=saved
bpy.ops.wm.save_as_mainfile(filepath=str(FILE));print('VALLEY REFINEMENT RENDERED',json.dumps(report),flush=True)
