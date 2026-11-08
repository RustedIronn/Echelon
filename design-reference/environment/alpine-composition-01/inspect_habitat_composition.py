import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
r=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'))
s=bpy.context.scene;c=s.camera;g=BVHTree.FromObject(bpy.data.objects['Continuous meadow foothills and mountain range'],bpy.context.evaluated_depsgraph_get())
f=c.data.view_frame(scene=s);x0=min(p.x for p in f);x1=max(p.x for p in f);y0=min(p.y for p in f);y1=max(p.y for p in f)
for u,v in [(.035,.32),(.055,.32),(.075,.31),(.025,.30)]:
    d=(c.matrix_world.to_3x3()@Vector((x0+(x1-x0)*u,y0+(y1-y0)*v,f[0].z))).normalized();p,n,face,dist=g.ray_cast(c.location,d,500)
    print('MARKED REGION',json.dumps({'uv':[u,v],'root':list(p),'camera_distance':dist,'alder_6m_top':list(world_to_camera_view(s,c,p+Vector((0,0,6))))}))
for i in range(1,6):
    o=bpy.data.objects[f'Village {i:02} wall mass'];p=[o.matrix_world@v.co for v in o.data.vertices];cx=sum(v.x for v in p)/len(p);cy=sum(v.y for v in p)/len(p)
    hit,*_=g.ray_cast(Vector((cx,cy,300)),Vector((0,0,-1)),600)
    print('HAMLET',json.dumps({'index':i,'center':[cx,cy],'ground':hit.z,'wall_bottom':min(v.z for v in p),'wall_top':max(v.z for v in p)}))
for x,y in [(20,100),(40,110),(40,135),(60,140),(40,160),(60,170)]:
    p,*_=g.ray_cast(Vector((x,y,300)),Vector((0,0,-1)),600);print('HILL',x,y,p.z)
