"""Material-only cliff upgrade: coherent triplanar PBR and reoriented normals."""
import bpy,json,hashlib,sys,math
from pathlib import Path
import numpy as np
R=Path(__file__).resolve().parent;ASSET=R/'material-resources/mountain-cliff-pbr';FILE=R/'echelon_alpine_composition_01.blend';bpy.ops.wm.open_mainfile(filepath=str(FILE));s=bpy.context.scene;c=s.camera;terrain=bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks']
def xyz(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return a
def hashes():return {o.name:hashlib.sha256(xyz(o).tobytes()).hexdigest() for o in s.objects if o.type=='MESH' and (o.name in ['Continuous meadow foothills and mountain range','Water inside carved channel - static graded surface'] or o.name.startswith('Meadow blooms - '))}
meta_path=R/'mountain_pbr_preservation.json'
if not meta_path.exists():meta_path.write_text(json.dumps({'meshes':hashes(),'camera':[list(v) for v in c.matrix_world],'lens':c.data.lens,'dof':c.data.dof.use_dof,'sun_energy':bpy.data.objects['Simple afternoon sun'].data.energy,'render_filter_width':s.render.filter_size},indent=2))
meta=json.loads(meta_path.read_text());assert hashes()==meta['meshes'];print('PREPASS DOF',c.data.dof.use_dof,flush=True)
images={};manifest=[]
for role,ext in [('diff','jpg'),('rough','jpg'),('nor_gl','png'),('disp','exr')]:
 path=ASSET/f'marble_cliff_02_{role}_4k.{ext}';im=bpy.data.images.load(str(path),check_existing=True);im.colorspace_settings.name='sRGB' if role=='diff' else 'Non-Color';assert list(im.size)==[4096,4096],(role,im.size[:]);im.pack();images[role]=im;manifest.append({'role':role,'file':path.name,'size':list(im.size),'colorspace':im.colorspace_settings.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
name='Echelon alpine cliff PBR - sharp world projection';old=bpy.data.node_groups.get(name)
if old:
 for n in list(terrain.nodes):
  if n.type=='GROUP' and n.node_tree==old:terrain.nodes.remove(n)
 bpy.data.node_groups.remove(old)
t=bpy.data.node_groups.new(name,'ShaderNodeTree')
for n,typ in [('Color','NodeSocketColor'),('Roughness','NodeSocketFloat'),('Normal','NodeSocketVector'),('Height','NodeSocketFloat')]:t.interface.new_socket(name=n,in_out='OUTPUT',socket_type=typ)
L=t.links;nodes=t.nodes

def node(typ,name):n=nodes.new(typ);n.name=name;n.label=name;return n

def bind(value,socket):
 if isinstance(value,(int,float,np.number)):socket.default_value=float(value)
 elif isinstance(value,tuple):socket.default_value=value
 else:L.new(value,socket)
def mathn(op,a,b=None,label=None):
 n=node('ShaderNodeMath',label or op);n.operation=op;bind(a,n.inputs[0])
 if b is not None:bind(b,n.inputs[1])
 return n.outputs[0]
def vec(op,a,b=None,label=None):
 n=node('ShaderNodeVectorMath',label or op);n.operation=op;bind(a,n.inputs[0])
 if b is not None:bind(b,n.inputs['Scale'] if op=='SCALE' else n.inputs[1])
 return n.outputs['Vector']
def combine(x,y,z,label):
 n=node('ShaderNodeCombineXYZ',label)
 for i,v in enumerate([x,y,z]):bind(v,n.inputs[i])
 return n.outputs[0]
def separate(value,label):
 n=node('ShaderNodeSeparateXYZ',label);L.new(value,n.inputs[0]);return [n.outputs[i] for i in range(3)]
def value(label,v):n=node('ShaderNodeValue',label);n.outputs[0].default_value=v;return n.outputs[0]
geo=node('ShaderNodeNewGeometry','Unperturbed world surface');P=geo.outputs['Position'];N=geo.outputs['Normal'];axes=separate(N,'Surface normal components');sg=[mathn('SIGN',v,label='Projection handedness '+str(i)) for i,v in enumerate(axes)];powers=[mathn('POWER',mathn('ABSOLUTE',v),value('Projection sharpness '+str(i),4)) for i,v in enumerate(axes)];total=mathn('ADD',mathn('ADD',powers[0],powers[1]),powers[2]);weights=[mathn('DIVIDE',v,total) for v in powers]
metres=value('Main cliff tile metres',32);scaled=vec('SCALE',P,mathn('DIVIDE',1,metres));px,py,pz=separate(scaled,'Cliff world coordinates');uvs=[combine(mathn('MULTIPLY',py,sg[0]),pz,0,'X projection YZ'),combine(mathn('MULTIPLY',mathn('MULTIPLY',px,sg[1]),-1),pz,0,'Y projection XZ'),combine(mathn('MULTIPLY',px,sg[2]),py,0,'Z projection XY')]
def image_sample(role,uv,label):
 n=node('ShaderNodeTexImage',label);n.image=images[role];n.extension='REPEAT';n.interpolation='Linear';n.projection='FLAT';L.new(uv,n.inputs['Vector']);return n.outputs['Color']
def sum_weighted(samples):return vec('ADD',vec('ADD',vec('SCALE',samples[0],weights[0]),vec('SCALE',samples[1],weights[1])),vec('SCALE',samples[2],weights[2]))
colors=[image_sample('diff',uv,'4K cliff albedo axis '+str(i)) for i,uv in enumerate(uvs)];rough=[image_sample('rough',uv,'4K cliff roughness axis '+str(i)) for i,uv in enumerate(uvs)];heights=[image_sample('disp',uv,'4K cliff height axis '+str(i)) for i,uv in enumerate(uvs)]
color=sum_weighted(colors);height=sum_weighted(heights);roughness=sum_weighted(rough)
grade=node('ShaderNodeHueSaturation','Natural warm-grey mineral palette');grade.inputs['Saturation'].default_value=.32;grade.inputs['Value'].default_value=.80;L.new(color,grade.inputs['Color'])
# Whiteout-style reorientation preserves the actual mesh normal for a flat normal
# map, avoiding cube-axis shading. Sign-correct UVs and bases are shared by PBR maps.
strength=value('Cliff normal strength',.46);normal_samples=[]
for i,uv in enumerate(uvs):
 sample=image_sample('nor_gl',uv,'4K OpenGL normal axis '+str(i));decoded=vec('ADD',vec('SCALE',sample,2),(-1,-1,-1));sx,sy,sz=separate(decoded,'Normal map components '+str(i));sx=mathn('MULTIPLY',sx,strength);sy=mathn('MULTIPLY',sy,strength);sz=mathn('ADD',mathn('MULTIPLY',sz,strength),mathn('SUBTRACT',1,strength))
 if i==0:world=combine(mathn('MULTIPLY',sz,axes[0]),mathn('ADD',mathn('MULTIPLY',sx,sg[0]),axes[1]),mathn('ADD',sy,axes[2]),'X normal in world space')
 elif i==1:world=combine(mathn('ADD',mathn('MULTIPLY',mathn('MULTIPLY',sx,sg[1]),-1),axes[0]),mathn('MULTIPLY',sz,axes[1]),mathn('ADD',sy,axes[2]),'Y normal in world space')
 else:world=combine(mathn('ADD',mathn('MULTIPLY',sx,sg[2]),axes[0]),mathn('ADD',sy,axes[1]),mathn('MULTIPLY',sz,axes[2]),'Z normal in world space')
 normal_samples.append(world)
normal=vec('NORMALIZE',sum_weighted(normal_samples))
# Smaller-scale height adds restrained grain without duplicating large cracks.
detail_scale=mathn('DIVIDE',metres,value('Fine cliff tile metres',6.8));detail_height=sum_weighted([image_sample('disp',vec('SCALE',uv,detail_scale),'Fine grain height axis '+str(i)) for i,uv in enumerate(uvs)])
bump=node('ShaderNodeBump','Restrained fine rock grain');bump.inputs['Strength'].default_value=.16;bump.inputs['Distance'].default_value=.012;L.new(detail_height,bump.inputs['Height']);L.new(normal,bump.inputs['Normal'])
out=node('NodeGroupOutput','Cliff PBR outputs')
for key,v in [('Color',grade.outputs['Color']),('Roughness',roughness),('Normal',bump.outputs['Normal']),('Height',height)]:L.new(v,out.inputs[key])
# Replace only the mountain rock branches of the existing terrain system.
group=terrain.nodes.new('ShaderNodeGroup');group.name='High resolution mountain cliff PBR';group.node_tree=t
palette=terrain.nodes['Alpine rock mineral palette'];palette.inputs['Saturation'].default_value=1;palette.inputs['Value'].default_value=1;terrain.links.new(group.outputs['Color'],palette.inputs['Color']);terrain.nodes['Scanned alpine rock faces'].inputs[0].default_value=.94;terrain.links.new(group.outputs['Roughness'],terrain.nodes['Rock roughness map'].inputs[2])
# Keep existing meadow/bank normal chains; add cliff normals only on exposed rock.
legacy=terrain.nodes['Scanned geological relief']
for link in list(legacy.inputs['Strength'].links):terrain.links.remove(link)
legacy.inputs['Strength'].default_value=0
p=terrain.nodes['Terrain surface'];rockmask=terrain.nodes['alpine_rock'].outputs['Fac'];snowmask=terrain.nodes['Terrain and rock-led snow cover'].outputs[0]
def tm(op,a,b,label):
 n=terrain.nodes.get(label) or terrain.nodes.new('ShaderNodeMath');n.name=label;n.operation=op
 for i,v in enumerate([a,b]):
  if isinstance(v,(int,float)):n.inputs[i].default_value=v
  else:terrain.links.new(v,n.inputs[i])
 return n.outputs[0]
mask=tm('MULTIPLY',rockmask,tm('SUBTRACT',1,snowmask,'Cliff snow exclusion'),'Exposed rock normal mask');inv=tm('SUBTRACT',1,mask,'Keep other terrain normals')
def tv(op,a,b,label):
 n=terrain.nodes.get(label) or terrain.nodes.new('ShaderNodeVectorMath');n.name=label;n.operation=op;terrain.links.new(a,n.inputs[0])
 if b is not None:terrain.links.new(b,n.inputs['Scale'] if op=='SCALE' else n.inputs[1])
 return n.outputs['Vector']
oldnormal=tv('SCALE',legacy.outputs['Normal'],inv,'Retained meadow bank shading');newnormal=tv('SCALE',group.outputs['Normal'],mask,'New exposed cliff shading');normal=tv('NORMALIZE',tv('ADD',oldnormal,newnormal,'Terrain and cliff normal blend'),None,'Unit terrain surface normal');terrain.links.new(normal,p.inputs['Normal'])
# Geometry, camera and environmental light stay unchanged.
assert hashes()==meta['meshes'];assert [list(v) for v in c.matrix_world]==meta['camera'] and c.data.lens==meta['lens'];assert bpy.data.objects['Simple afternoon sun'].data.energy==meta['sun_energy']
report={'source':'https://polyhaven.com/a/marble_cliff_02','creator':'Amal Kumar','license':'CC0','maps':manifest,'mapping':'Sign-correct three-axis world projection with exponent-4 weights; reoriented OpenGL normals','main_tile_metres':32,'fine_tile_metres':6.8,'normal_strength':.46,'geometry_camera_lighting_unchanged':True,'camera_dof_enabled':c.data.dof.use_dof,'committed':'--commit' in sys.argv};(R/'mountain_pbr_report.json').write_text(json.dumps(report,indent=2))
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type!='CPU'
saved=(s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.render.use_border,s.render.use_crop_to_border,s.render.filter_size,s.cycles.adaptive_threshold)
s.cycles.device='GPU';s.cycles.samples=256;s.cycles.adaptive_threshold=.004;s.cycles.use_denoising=True;s.render.filter_size=1.0;s.render.resolution_x=2560;s.render.resolution_y=1440;s.render.resolution_percentage=100;s.render.use_border=False;s.render.filepath=str(R/'mountain_pbr_preview.png');bpy.ops.render.render(write_still=True)
s.render.resolution_x=3840;s.render.resolution_y=2160;s.render.use_border=True;s.render.use_crop_to_border=True;s.render.border_min_x=.02;s.render.border_max_x=.98;s.render.border_min_y=.46;s.render.border_max_y=.79;s.render.filepath=str(R/'mountain_pbr_detail.png');bpy.ops.render.render(write_still=True)
s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.cycles.device,s.render.filepath,s.render.use_border,s.render.use_crop_to_border,s.render.filter_size,s.cycles.adaptive_threshold=saved
if '--commit' in sys.argv:
 bpy.context.preferences.filepaths.save_version=0;s.render.filter_size=1.0;s.cycles.samples=256;s.cycles.adaptive_threshold=.004;s.cycles.use_denoising=True;s.render.resolution_x=2560;s.render.resolution_y=1440;s.render.resolution_percentage=100;bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
print('MOUNTAIN PBR COMPLETE',json.dumps(report),flush=True)
