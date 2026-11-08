"""Recover native middle/foothill roots for cheaper distance blades; no new scatter or master edits."""
import bpy,numpy as np,json,hashlib
from pathlib import Path
R=Path(__file__).resolve().parent;OUT=R.parents[2]/'public/assets/environment/alpine-prototype';MASTER=R.parent/'alpine-composition-01/echelon_alpine_composition_01.blend'
metadata=json.loads((OUT/'canopy-material.json').read_text());before=hashlib.sha256(MASTER.read_bytes()).hexdigest();assert before==metadata['sourceSha256']
bpy.ops.wm.open_mainfile(filepath=str(MASTER),load_ui=False)
def arr(data,prop,n,dtype=np.float32):
 a=np.empty((len(data),n),dtype);data.foreach_get(prop,a.ravel());return a
metadata['grass']=[]
for layer,name in [(2,'Midground meadow continuation'),(3,'Meadow to foothill transition')]:
 o=bpy.data.objects[name];points=arr(o.data.vertices,'co',3)
 if o.data.attributes.get('tree_habitat_z'):points[:,2]+=arr(o.data.attributes['tree_habitat_z'].data,'value',1)[:,0]
 blades=points.reshape((-1,12,3));roots=blades[:,1,:];leaf=blades-roots[:,None,:];tip=leaf[:,-2,:];angle=np.arctan2(tip[:,1],tip[:,0]);length=np.maximum(.015,np.linalg.norm(tip[:,:2],axis=1));height=np.maximum(.015,leaf[:,:,2].max(axis=1));side=-leaf[:,:,0]*np.sin(angle)[:,None]+leaf[:,:,1]*np.cos(angle)[:,None];width=np.maximum(.001,np.abs(side[:,2::3]-side[:,0::3]).max(axis=1))
 template_ids=np.linspace(0,len(blades)-1,12,dtype=int);features=tip[:,2]/height;error=np.abs(features[:,None]-features[template_ids][None,:]);variants=np.argmin(error,axis=1)
 material=np.array([p.material_index for p in o.data.polygons]).reshape((len(blades),-1))[:,0];valid=np.ones(len(blades),bool)
 if o.data.attributes.get('tree_habitat_thin'):valid &= ~arr(o.data.attributes['tree_habitat_thin'].data,'value',1,np.bool_).reshape((len(blades),-1)).all(axis=1)
 records=np.column_stack((roots,angle,length,height,material,variants,width)).astype('<f4')[valid];filename=f'grass-canopy-{layer}.bin';records.tofile(OUT/filename)
 metadata['grass'].append({'layer':layer,'source':name,'file':filename,'stride':9,'count':len(records),'samplingFraction':1,'representation':'Authored full middle/foothill roots, narrow three-triangle curved strips; camera-frustum culling with 20% NDC margin'})
 print(name,len(records),'min/max distance',np.hypot(records[:,0]+3,records[:,1]+10).min(),np.hypot(records[:,0]+3,records[:,1]+10).max(),flush=True)
assert hashlib.sha256(MASTER.read_bytes()).hexdigest()==before
(OUT/'canopy-material.json').write_text(json.dumps(metadata,indent=2));(R/'canopy-material-report.json').write_text(json.dumps(metadata,indent=2))
