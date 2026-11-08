import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'echelon_alpine_composition_01.blend'))
s=bpy.context.scene;c=s.camera;deps=bpy.context.evaluated_depsgraph_get()
g=bpy.data.objects['Continuous meadow foothills and mountain range'];w=bpy.data.objects['Water inside carved channel - static graded surface']
ground=BVHTree.FromObject(g,deps);water=BVHTree.FromObject(w,deps)
report={'objects':[{'name':o.name,'type':o.type,'vertices':len(o.data.vertices) if o.type=='MESH' else None} for o in s.objects],'camera':{'matrix':[list(v) for v in c.matrix_world],'lens':c.data.lens},'samples':[],'camera_ground_grid':[]}
for x,y in [(-70,115),(-65,130),(72,150),(52,115),(-37,172),(-17,105),(-22,135),(58,90),(65,155),(-45,92)]:
    hit,n,face,d=ground.ray_cast(Vector((x,y,300)),Vector((0,0,-1)),600)
    if hit is None:continue
    projections=[list(world_to_camera_view(s,c,hit+Vector((0,0,z)))) for z in [0,14,17]]
    report['samples'].append({'xy':[x,y],'ground_z':hit.z,'projected_base_14m_17m':projections,'normal':list(n)})
frame=c.data.view_frame(scene=s);xmin=min(p.x for p in frame);xmax=max(p.x for p in frame);ymin=min(p.y for p in frame);ymax=max(p.y for p in frame)
for v in [.04,.15,.27,.38,.46]:
    for u in [.05,.25,.5,.75,.95]:
        d=(c.matrix_world.to_3x3()@Vector((xmin+(xmax-xmin)*u,ymin+(ymax-ymin)*v,frame[0].z))).normalized()
        p,n,face,dist=ground.ray_cast(c.location,d,500)
        wp,wn,wf,wd=water.ray_cast(c.location,d,500)
        report['camera_ground_grid'].append({'uv':[u,v],'point':list(p) if p else None,'water_in_front':bool(wp and p and wd<dist),'distance':dist})
(ROOT/'ecosystem_target_inspection.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'samples':report['samples'],'foreground':report['camera_ground_grid']},indent=2),flush=True)
