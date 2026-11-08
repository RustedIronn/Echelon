import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
r=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'));s=bpy.context.scene;c=s.camera;g=bpy.data.objects['Continuous meadow foothills and mountain range'];bv=BVHTree.FromObject(g,bpy.context.evaluated_depsgraph_get());frame=c.data.view_frame(scene=s);mnx=min(p.x for p in frame);mxx=max(p.x for p in frame);mny=min(p.y for p in frame);mxy=max(p.y for p in frame)
for u in [.20,.35,.5,.65,.8]:
 for v in [.49,.50,.505,.51,.515,.52]:
  ray=(c.matrix_world.to_3x3()@Vector((mnx+(mxx-mnx)*u,mny+(mxy-mny)*v,frame[0].z))).normalized();p,n,fi,d=bv.ray_cast(c.location,ray,1500)
  print('LINE',u,v,list(p) if p else None,list(n) if n else None,flush=True)
