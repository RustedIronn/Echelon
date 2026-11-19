"""Reads the approved master (never saves it): its stream stones (the limestone collection) into valley-stones.blend."""
import bpy, mathutils
from pathlib import Path
HERE = Path(__file__).resolve().parent
col = bpy.data.collections['10 Stream habitat - reusable limestone']; out = set()
for o in col.all_objects:
    if o.type != 'MESH': continue
    c = o.copy(); c.data = o.data.copy(); c.modifiers.clear(); c.matrix_world = mathutils.Matrix.Identity(4); c.name = 'STONE ' + o.name
    bb = [mathutils.Vector(b) for b in c.bound_box]; size = max(v.x for v in bb) - min(v.x for v in bb)
    print('STONE', c.name, len(c.data.vertices), 'size', round(size, 2), [m.name for m in c.data.materials]); out.add(c)
bpy.data.libraries.write(str(HERE / 'valley-stones.blend'), out, fake_user=True, compress=True)
