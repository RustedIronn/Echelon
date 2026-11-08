import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
r=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'))
s=bpy.context.scene;c=s.camera;deps=bpy.context.evaluated_depsgraph_get();g=BVHTree.FromObject(bpy.data.objects['Continuous meadow foothills and mountain range'],deps);w=BVHTree.FromObject(bpy.data.objects['Water inside carved channel - static graded surface'],deps)
f=c.data.view_frame(scene=s);x0=min(p.x for p in f);x1=max(p.x for p in f);y0=min(p.y for p in f);y1=max(p.y for p in f)
for u,v in [(.10,.35),(.14,.35),(.17,.34),(.20,.36),(.22,.35),(.10,.34),(.13,.37),(.18,.37),(.20,.38)]:
    d=(c.matrix_world.to_3x3()@Vector((x0+(x1-x0)*u,y0+(y1-y0)*v,f[0].z))).normalized();p,n,face,dist=g.ray_cast(c.location,d,500);wp,wn,wf,wd=w.ray_cast(c.location,d,500)
    print('SITE',json.dumps({'uv':[u,v],'root':list(p),'distance':dist,'water_in_front':bool(wp and wd<dist),'tree_6m_top':list(world_to_camera_view(s,c,p+Vector((0,0,6))))}))
for name in ['Sage meadow','Echelon terrain - meadow rock snow and wet banks']:
    owner=bpy.data.materials.get(name) or bpy.data.node_groups.get(name);t=owner.node_tree if hasattr(owner,'node_tree') else owner
    print('GRAPH',name)
    for n in t.nodes:
        if n.type in ['BSDF_PRINCIPLED','GROUP','TEX_IMAGE']:
            print(n.name,n.type,n.image.name if n.type=='TEX_IMAGE' and n.image else '',[(link.from_node.name,link.from_socket.name,link.to_socket.name) for link in t.links if link.to_node==n])
