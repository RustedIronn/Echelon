"""Foreground habitat and localized hamlet-shoulder refinement, in place.
Keeps the camera, mountain coordinates, water, flower XY distribution and source
models intact. Local vegetation follows the edited ground vertically.
"""
import bpy,json,math,hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parent;FILE=ROOT/'echelon_alpine_composition_01.blend'
FERN=ROOT.parent/'asset-auditions'/'ecosystem-candidates'/'sources'/'fern-02'/'fern_02_2k.blend'
bpy.ops.wm.open_mainfile(filepath=str(FILE));scene=bpy.context.scene;camera=scene.camera
ferncol=bpy.data.collections.get('07 Sheltered habitat plants')
if ferncol:
    for ob in list(ferncol.all_objects):bpy.data.objects.remove(ob,do_unlink=True)
    for child in list(ferncol.children):bpy.data.collections.remove(child)
    bpy.data.collections.remove(ferncol)
treecol=bpy.data.collections['Authored trees and saplings - individual placements']
GROUND='Continuous meadow foothills and mountain range'
following=[GROUND,'Foreground arching grass','Low basal meadow foliage','Midground meadow continuation','Meadow to foothill transition']
following += [o.name for o in scene.objects if o.name.startswith('Meadow blooms - ')]

def coords(ob):
    a=np.empty((len(ob.data.vertices),3),dtype=np.float32);ob.data.vertices.foreach_get('co',a.ravel());return a

def digest(a):return hashlib.sha256(a.tobytes()).hexdigest()

def smooth(a):
    a=np.clip(a,0,1);return a*a*(3-2*a)

def lowering(x,y):
    x=np.asarray(x);y=np.asarray(y);r2=((x-43)/34)**2+((y-146)/35)**2
    value=-1.55*np.exp(-r2)*smooth((x-8)/16)*smooth((y-65)/25)*(1-smooth((y-165)/30))*smooth((9-r2)/3)
    return np.where((x>8)&(y>65)&(y<195)&(r2<9),value,0)

baseline_file=ROOT/'habitat_scene_baseline.json';archive_file=ROOT/'habitat_grounding_baseline.npz'
if not baseline_file.exists():
    b={'camera':{'name':camera.name,'matrix':[list(r) for r in camera.matrix_world],'lens':camera.data.lens},'mesh_hashes':{},'mesh_xy_hashes':{},'objects':{},'following':{},'building_centers':{}}
    storage={}
    for ob in scene.objects:
        b['objects'][ob.name]={'type':ob.type,'matrix':[list(r) for r in ob.matrix_world],'location':list(ob.location),'rotation':list(ob.rotation_euler),'scale':list(ob.scale),'hide_render':ob.hide_render,'hide_viewport':ob.hide_viewport,'ground_seat':ob.get('ground_seat_height')}
        if ob.type=='MESH':
            a=coords(ob);b['mesh_hashes'][ob.name]=digest(a);b['mesh_xy_hashes'][ob.name]=digest(a[:,:2].copy())
        if ob.type=='LIGHT':b['objects'][ob.name]['energy']=ob.data.energy
    a=coords(bpy.data.objects[GROUND]);b['mountain_y225_plus_hash']=digest(a[a[:,1]>=225].copy())
    for i,name in enumerate(following):
        ob=bpy.data.objects[name];assert ob.matrix_world==Matrix.Identity(4),name
        a=coords(ob);d=lowering(a[:,0],a[:,1]);idx=np.flatnonzero(abs(d)>1e-7).astype(np.int32)
        key='mesh_'+str(i);storage[key+'_indices']=idx;storage[key+'_z']=a[idx,2].copy()
        b['following'][name]={'key':key,'vertex_count':len(a),'changed_indices':len(idx)}
        if name.startswith('Meadow blooms - '):
            attrs={}
            for attr in ['plant_rotation','plant_scale']:
                v=np.empty((len(ob.data.attributes[attr].data),3),dtype=np.float32);ob.data.attributes[attr].data.foreach_get('vector',v.ravel());attrs[attr]=digest(v)
            b['following'][name]['attributes']=attrs
    for i in range(1,6):
        ob=bpy.data.objects[f'Village {i:02} wall mass'];a=coords(ob);p=np.array([(ob.matrix_world@Vector(v))[:] for v in a]);b['building_centers'][f'Village {i:02}']=[float(p[:,0].mean()),float(p[:,1].mean())]
    np.savez_compressed(archive_file,**storage);baseline_file.write_text(json.dumps(b,indent=2),encoding='utf-8')
else:b=json.loads(baseline_file.read_text())
report={'ground_changes':{},'hamlet':[],'trees':[],'ferns':[],'notes':[]}
archive=np.load(archive_file)
for name,item in b['following'].items():
    ob=bpy.data.objects[name];a=coords(ob);assert len(a)==item['vertex_count'] and digest(a[:,:2].copy())==b['mesh_xy_hashes'][name],name
    idx=archive[item['key']+'_indices'];z=archive[item['key']+'_z'];d=lowering(a[idx,0],a[idx,1])
    a[idx,2]=z+d.astype(np.float32);ob.data.vertices.foreach_set('co',a.ravel());ob.data.update()
    report['ground_changes'][name]={'changed_vertices':len(idx),'maximum_lowering_m':float(-d.min()) if len(d) else 0}
# Every building is translated as a rigid assembly, not deformed or rescaled.
for prefix,xy in b['building_centers'].items():
    dz=float(lowering(*xy));parts=[]
    for ob in scene.objects:
        if ob.name.startswith(prefix+' '):
            old=b['objects'][ob.name];ob.location=old['location'];ob.location.z+=dz
            if old.get('ground_seat') is not None:ob['ground_seat_height']=old['ground_seat']+dz
            parts.append(ob.name)
    report['hamlet'].append({'building':prefix,'center_xy':xy,'vertical_seating_change_m':dz,'parts':len(parts)})
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
gb=BVHTree.FromObject(bpy.data.objects[GROUND],deps);wb=BVHTree.FromObject(bpy.data.objects['Water inside carved channel - static graded surface'],deps)

def ground(x,y):
    p,n,f,d=gb.ray_cast(Vector((x,y,300)),Vector((0,0,-1)),600);assert p is not None;return p,n

def position(oldname,newname,x,y,size,yaw,intent):
    ob=bpy.data.objects.get(oldname) or bpy.data.objects.get(newname)
    if ob is None:
        species=newname.split(' - ')[0];proto=bpy.data.objects['SOURCE - '+species]
        ob=bpy.data.objects.new(newname,proto.data);treecol.objects.link(ob);ob['species']=species
    p,n=ground(x,y)
    wp,*_=wb.ray_cast(Vector((x,y,300)),Vector((0,0,-1)),600);assert wp is None or wp.z<p.z-.15,(newname,'water')
    ob.name=newname;ob.location=(x,y,p.z-.08);ob.rotation_euler=(0,0,yaw);ob.scale=(size,)*3;ob.hide_render=False;ob.hide_set(False);ob['placement_intent']=intent
    q=world_to_camera_view(scene,camera,ob.location)
    report['trees'].append({'name':newname,'species':ob.get('species'),'root':list(ob.location),'scale':size,'screen_root':list(q),'approx_height_m':ob.dimensions.z,'intent':intent})
position('Norway Spruce - foreground-left stream shelter','Norway Spruce - foreground-left stream shelter',-15.14549255,9.97603035,.3616448145409881,.35,'Familiar Norway spruce silhouette at the annotated foreground location, about 6 m above the authored ground reference.')
position('Larch - left slope anchor','Larch - left slope anchor',-73,163,.92,1.85,'Mature larch farther back, part of a loose slope family behind the foreground shelter.')
position('Norway Spruce - distant left foothill remnant','Norway Spruce - distant left foothill remnant',-112,205,.82,-1.4,'Subordinate mature conifer at a different depth; no equal-height side-by-side pairing.')
position('Norway Spruce - quiet right hillside','Norway Spruce - quiet right hillside',82,174,.78,2.8,'Single mature right-side conifer with sparse young growth; keeps the hamlet and mountain outline clear.')
position('Fir A - young growth below left anchor','Fir A - young growth below left anchor',-69,159,1,1.3,'Young growth below the left larch, not a separate isolated specimen.')
position('Fir C - young growth behind left anchor','Fir C - young growth behind left anchor',-79,174,1.2,-.4,'Smaller recruit offset behind the larch on the slope.')
position('HELD - Fir B - restrained young foothill growth','Fir B - young growth on right shoulder',88,177,1.2,.8,'One of two unevenly spaced recruits near the mature right conifer.')
position('HELD - Fir B - restrained young foothill growth.001','Fir B - smaller right shoulder recruit',80,181,.85,-1.9,'Smaller recruit further upslope, with unequal scale and spacing.')
position('HELD - Larch - receding right foothill','Larch - smaller recruit in left slope group',-65,157,.58,-.75,'Smaller roughly 10 m larch partially overlapping the main left anchor; unequal age, height and spacing within one loose growth group.')
# The existing spare larch is reused locally, not added as another isolated landmark.
selected_tree_names={item['name'] for item in report['trees']}
for existing in treecol.objects:
    if existing.name not in selected_tree_names:existing.hide_render=True;existing.hide_set(True)
ferncol=bpy.data.collections.new('07 Sheltered habitat plants');scene.collection.children.link(ferncol)
sources=bpy.data.collections.new('Fern sources - CC0 - hidden');ferncol.children.link(sources)
placements=bpy.data.collections.new('Ferns under foreground alder - editable shared meshes');ferncol.children.link(placements)
with bpy.data.libraries.load(str(FERN),link=False) as (fr,to):to.objects=[name for name in fr.objects if name.startswith('fern_02_')]
protos={}
for ob in to.objects:
    if not ob or ob.type!='MESH':continue
    sources.objects.link(ob);bpy.context.view_layer.update();me=ob.data.copy();me.transform(ob.matrix_world)
    pts=[v.co.copy() for v in me.vertices];z=min(v.z for v in pts);near=[v for v in pts if v.z<z+.025]
    anchor=Vector((sum(v.x for v in near)/len(near),sum(v.y for v in near)/len(near),z));me.transform(Matrix.Translation(-anchor))
    proto=bpy.data.objects.new('SOURCE - '+ob.name,me);sources.objects.link(proto);proto.hide_render=True;proto.hide_set(True);ob.hide_render=True;ob.hide_set(True);protos[ob.name]=proto
# Small irregular understory, using four variants rather than repeated bush islands.
for i,(variant,x,y,size,yaw) in enumerate([('a',-14.8,10.8,.9,.3),('b',-13.6,12.6,.85,1.7),('c',-15.8,12.2,.80,-.6),('d',-14.2,13.1,1.05,2.5),('a',-16.4,11.4,1.1,-1.3),('c',-15.1,13.4,.9,.9),('b',-17.0,10.6,.75,2.1)]):
    source=protos['fern_02_'+variant];p,n=ground(x,y);ob=bpy.data.objects.new(f'Sheltered fern {i+1:02} - variant {variant}',source.data);placements.objects.link(ob);ob.location=(x,y,p.z-.015);ob.scale=(size,)*3
    ob.rotation_euler=(Vector((0,0,1)).rotation_difference(n).to_matrix().to_4x4()@Matrix.Rotation(yaw,4,'Z')).to_euler();ob['habitat']='Small sheltered near-stream understory associated with foreground alder.'
    report['ferns'].append({'name':ob.name,'variant':variant,'root':list(ob.location),'scale':size})
for im in bpy.data.images:
    if im.source=='FILE' and not im.packed_file and all(im.size):im.pack()
a=coords(bpy.data.objects[GROUND]);assert digest(a[a[:,1]>=225].copy())==b['mountain_y225_plus_hash']
assert [list(r) for r in camera.matrix_world]==b['camera']['matrix'] and camera.data.lens==b['camera']['lens']
report['notes']=['No mountain vertex at Y>=225 changed; no mountain translation or rescaling.','The hamlet shoulder is lowered with a compact smooth field, maximum 1.55 m; existing grass and flower roots follow the same field.','Building XY positions, architectural dimensions and roof geometry are retained; each building is reseated rigidly, with local foundation checks deferred to saved-file validation.','No flowers are redistributed, recolored or rescaled. Only affected root Z coordinates change to follow the local ground edit.','The foreground Norway spruce replaces the alder and is sized at roughly 6 m; mature anchor conifer scales are unchanged; the spare larch is reused as a smaller roughly 10 m subordinate within the left group.','Seven ferns, one CC0 source family, are confined to the sheltered foreground root area. No blanket shrub scatter or new tree types.']
report['camera_unchanged']=True;report['mountains_unchanged']=True
bpy.context.preferences.filepaths.save_version=0
bpy.ops.object.select_all(action='DESELECT');camera.select_set(True);bpy.context.view_layer.objects.active=camera
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
saved=(scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage,scene.cycles.samples,scene.cycles.device,scene.render.filepath,scene.cycles.use_denoising)
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
    for d in prefs.devices:d.use=d.type!='CPU'
    scene.cycles.device='GPU'
except Exception:scene.cycles.device='CPU'
scene.cycles.samples=128;scene.cycles.use_denoising=True;scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100;scene.render.filepath=str(ROOT/'habitat_composition_preview.png')
bpy.ops.render.render(write_still=True)
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage,scene.cycles.samples,scene.cycles.device,scene.render.filepath,scene.cycles.use_denoising=saved
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
(ROOT/'habitat_composition_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('HABITAT PASS RENDERED',json.dumps({'trees':len(report['trees']),'ferns':len(report['ferns']),'hamlet':report['hamlet']}),flush=True)
