import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
r=Path(r'D:\Projects\Echelon\design-reference\environment\alpine-composition-01')
bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'))
s=bpy.context.scene;c=s.camera;g=BVHTree.FromObject(bpy.data.objects['Continuous meadow foothills and mountain range'],bpy.context.evaluated_depsgraph_get())
for x,y in [(-61,125),(-122,218),(-114,206),(-129,195),(88,174),(82,165),(94,155),(-61,124),(-69,139)]:
    p,n,f,d=g.ray_cast(Vector((x,y,300)),Vector((0,0,-1)),600)
    print(json.dumps({'xy':[x,y],'ground':p.z,'projected_base_12m_16m':[list(world_to_camera_view(s,c,p+Vector((0,0,z)))) for z in [0,12,16]]}))
