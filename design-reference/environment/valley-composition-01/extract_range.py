"""Cuts the approved range (everything beyond the meadow, 380 m+ from the master's camera) out of the master's terrain, keeping its painted
attributes and materials, scaled about the camera to valley scale and lifted like the grown range the user approved. Writes valley-range.blend."""
import bpy, bmesh, numpy as np, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
K = 12.0; LIFT = 1.6; CAM = np.array([-3.0, -10.0, 4.36])
o = bpy.data.objects['Continuous meadow foothills and mountain range']
bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world)
far = lambda v: np.hypot(v.co.x - CAM[0], v.co.y - CAM[1]) > 380
bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(far(v) for v in f.verts)], context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
me = bpy.data.meshes.new('RANGE approved'); bm.to_mesh(me); bm.free()
n = len(me.vertices); co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3).astype(np.float64)
z = co[:, 2]; t = np.clip((z - 15) / 25, 0, 1); lift = 1 + (LIFT - 1) * t * t * (3 - 2 * t)
out = np.empty_like(co); out[:, 0] = (co[:, 0] - CAM[0]) * K; out[:, 1] = (co[:, 1] - CAM[1]) * K; out[:, 2] = (z - 2.0) * K * lift
me.vertices.foreach_set('co', out.astype(np.float32).ravel()); me.update()
for m in o.data.materials: me.materials.append(m)
ob = bpy.data.objects.new('RANGE approved', me)
print('RANGE', n, 'verts; height', out[:, 2].max().round(0), 'dist', np.hypot(out[:, 0], out[:, 1]).min().round(0), np.hypot(out[:, 0], out[:, 1]).max().round(0))
bpy.data.libraries.write(str(HERE / 'valley-range.blend'), {ob}, fake_user=True, compress=True)
