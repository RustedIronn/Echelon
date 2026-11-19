"""Valley composition 01, step 6: the valley's hamlet (exported from the WebGL valley) moved onto the new shoulder - the chapel group on its
back, the farm group lower down by the river, the hay huts left out in the meadows - each building turned to face the viewer again and
seated on the highest ground under it (its stone plinth takes the slope). The old terrace's walls and the track fence are dropped. Grass,
flowers and trees are kept off the house plots."""
import bpy, math, mathutils, numpy as np
from pathlib import Path
HERE = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'valley_composition_01.blend')); scene = bpy.context.scene
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
for c in [c for c in bpy.data.collections if c.name == 'Hamlet']:
    for o in list(c.objects): bpy.data.objects.remove(o)
    bpy.data.collections.remove(c)
col = bpy.data.collections.new('Hamlet'); scene.collection.children.link(col)
before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=str(HERE / 'valley-hamlet.glb')); new = [o for o in bpy.data.objects if o not in before]
for o in new:
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)
root = [o for o in new if o.name.startswith('export:hamlet')][0]
near = scene.objects['Valley ground (near, 2 m)']; me = near.data; n = len(me.vertices)
co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(480, 500, 3)
gx0, gy0 = float(co[0, 0, 0]), float(co[0, 0, 1])  # x = -500 + 2i, y = 900 - 2j
def ground(x, y):
    fi = (x - gx0) / 2.0; fj = (gy0 - y) / 2.0; i = int(np.clip(np.floor(fi), 0, 498)); j = int(np.clip(np.floor(fj), 0, 478)); u, v = fi - i, fj - j
    z = co[:, :, 2]; return float((z[j, i] * (1 - u) + z[j, i + 1] * u) * (1 - v) + (z[j + 1, i] * (1 - u) + z[j + 1, i + 1] * u) * v)
UPPER_OLD, UPPER_NEW = mathutils.Vector((98.0, 415.0)), mathutils.Vector((212.0, 382.0))   # onto the shoulder's back
LOWER_OLD, LOWER_NEW = mathutils.Vector((30.0, 340.0)), mathutils.Vector((150.0, 250.0))   # the farm group, below it toward the river
face = lambda p: math.atan2(-p.x, p.y)
plots = []
for c in list(root.children):
    if c.name.startswith('dry-stone wall') or c.name.startswith('fence'):
        for o in [c] + list(c.children_recursive): bpy.data.objects.remove(o)
        continue
    p = c.matrix_world.translation.xy.copy()
    if (p - UPPER_OLD).length < 110: q = p - UPPER_OLD + UPPER_NEW
    elif (p - LOWER_OLD).length < 60: q = p - LOWER_OLD + LOWER_NEW
    else: q = p.copy()  # the hay huts stay where they are in the meadows
    turn = face(q) - face(p)
    M = mathutils.Matrix.Translation((q.x, q.y, 0)) @ mathutils.Matrix.Rotation(turn, 4, 'Z') @ mathutils.Matrix.Translation((-p.x, -p.y, 0))
    c.matrix_world = M @ c.matrix_world
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ mathutils.Vector(b) for o in [c] + list(c.children_recursive) if o.type == 'MESH' for b in o.bound_box]
    xs, ys = [v.x for v in pts], [v.y for v in pts]; cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2; hx, hy = (max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2
    top = max(ground(cx + a * hx * 0.8, cy + b * hy * 0.8) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1), (0, 0)))
    c.matrix_world.translation.z += top + 0.05 - c.matrix_world.translation.z
    plots.append((cx, cy, max(hx, hy) + 3.0))
bpy.context.view_layer.update()
# keep the house plots clear: grass, flowers and trees thin out round each building
x, y = co[:, :, 0].ravel(), co[:, :, 1].ravel(); keep = np.ones(n)
for cx, cy, r in plots: keep *= sm(r, r + 7, np.hypot(x - cx, y - cy))
for key in [a.name for a in me.attributes if a.name.startswith('dens_') or a.name == 'forest']:
    a = np.empty(n, np.float32); me.attributes[key].data.foreach_get('value', a); me.attributes[key].data.foreach_set('value', (a * keep).astype(np.float32))
print('HAMLET placed', len(plots))
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'valley_composition_01.blend'))
scene.render.filepath = str(HERE / 'renders' / 'hamlet-01.png'); bpy.ops.render.render(write_still=True); print('HAMLET done')
