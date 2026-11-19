"""Reads the approved master (never saves it) and writes valley-assets.blend: grass patches cut from its own meadow layers, and its
source plants (flowers, spruce, fir, larch, alder) with their materials."""
import bpy, bmesh, numpy as np
from pathlib import Path
HERE = Path(__file__).resolve().parent
src = bpy.data
def patch_from(obj_name, size=4.0, name=None):
    o = src.objects[obj_name]; me = o.data; n = len(me.vertices)
    co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    W = o.matrix_world; import mathutils
    # world xy (object transforms are identity for these layers in the master, but apply anyway)
    M = np.array(W); wco = co @ M[:3, :3].T + M[:3, 3]
    cell = np.floor(wco[:, :2] / size).astype(np.int64); key = cell[:, 0] * 100000 + cell[:, 1]
    u, cnt = np.unique(key, return_counts=True); best = u[np.argsort(cnt)[-3]]  # a dense cell, not the very densest (avoid a freak)
    cx, cy = best // 100000, best % 100000
    if cy > 50000: cx += 1; cy -= 100000
    x0, y0 = cx * size, cy * size
    bm = bmesh.new(); bm.from_mesh(me); bm.transform(W)
    keep = lambda v: x0 <= v.co.x < x0 + size and y0 <= v.co.y < y0 + size
    kill = [f for f in bm.faces if not all(keep(v) for v in f.verts)]
    bmesh.ops.delete(bm, geom=kill, context='FACES'); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    zmin = min((v.co.z for v in bm.verts), default=0)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(-x0 - size / 2, -y0 - size / 2, 0))
    # each blade's root sits on the ground at its own height: drop the slope of the source ground by flattening to the local minimum per blade is costly; use the patch's lowest point
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, -zmin))
    nm = bpy.data.meshes.new(name or obj_name + ' patch'); bm.to_mesh(nm); bm.free()
    for m in me.materials: nm.materials.append(m)
    ob = bpy.data.objects.new(name or obj_name + ' patch', nm); print('ASSET patch', obj_name, len(nm.vertices), 'at', x0, y0, 'zspan', max((v.co.z for v in nm.vertices), default=0))
    return ob
out = []
out.append(patch_from('Foreground arching grass', 4.0, 'PATCH grass tall'))
out.append(patch_from('Low basal meadow foliage', 4.0, 'PATCH grass basal'))
out.append(patch_from('Midground meadow continuation', 6.0, 'PATCH grass mid'))
out.append(patch_from('Meadow to foothill transition', 8.0, 'PATCH grass hill'))
for n in ['SOURCE - Norway Spruce', 'SOURCE - Fir A', 'SOURCE - Fir B', 'SOURCE - Fir C', 'SOURCE - Larch', 'SOURCE - Black Alder', 'SOURCE - Marguerite', 'SOURCE - Dandelion', 'SOURCE - Carthusian Pink', 'SOURCE - Red Clover']:
    o = src.objects[n]; c = o.copy(); c.data = o.data.copy(); c.matrix_world = o.matrix_world.copy(); c.name = n.replace('SOURCE - ', 'PLANT ')
    import mathutils; bb = [c.matrix_world @ mathutils.Vector(b) for b in o.bound_box]; print('ASSET', c.name, 'h', round(max(v.z for v in bb) - min(v.z for v in bb), 2), 'loc', tuple(round(x, 1) for x in o.matrix_world.translation))
    out.append(c)
for o in out: o.hide_render = False; o.hide_viewport = False
bpy.data.libraries.write(str(HERE / 'valley-assets.blend'), set(out), fake_user=True, compress=True)
print('ASSET done')
