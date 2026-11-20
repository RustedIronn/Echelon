"""South Tyrol farmhouses and barns for the valley composition, built from measured parts with real (Poly Haven, CC0) textures.
The model: a masoned, plastered ground floor; a storey of dark weathered larch boards above it; a wide gabled roof with deep eaves over a
balcony on the gable; small shuttered windows with flower boxes; a stone chimney. Barns: dark boards on a stone base under a shingled roof.
Every part is built in metres (no object scaling), so the textures, mapped in object space with box projection, keep their real size."""
import bpy, bmesh, math, mathutils
from pathlib import Path
TEX = Path('D:/Projects/Echelon/.claude/worktrees/perf-pass/design-reference/world-redesign/textures/ph')
_mats = {}

def material(name, tex, tile, tint=(1, 1, 1), rough_scale=1.0, bump=0.6):
    key = (name, tint)
    if key in _mats: return _mats[key]
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links.new; b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / tile, 1 / tile, 1 / tile); L(tc.outputs['Object'], mp.inputs['Vector'])
    def img(file, colour):
        t = N.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(str(TEX / tex / file), check_existing=True); t.projection = 'BOX'; t.projection_blend = 0.25
        if not colour: t.image.colorspace_settings.name = 'Non-Color'
        L(mp.outputs['Vector'], t.inputs['Vector']); return t
    d = img('diff.jpg', True); arm = img('arm.jpg', False); nrm = img('nor.jpg', False)
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1.0; mx.inputs[7].default_value = (*tint, 1); L(d.outputs['Color'], mx.inputs[6]); L(mx.outputs[2], b.inputs['Base Color'])
    sp = N.new('ShaderNodeSeparateColor'); L(arm.outputs['Color'], sp.inputs[0]); rs = N.new('ShaderNodeMath'); rs.operation = 'MULTIPLY'; rs.inputs[1].default_value = rough_scale; L(sp.outputs['Green'], rs.inputs[0]); L(rs.outputs[0], b.inputs['Roughness'])
    nm = N.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = bump; L(nrm.outputs['Color'], nm.inputs['Color']); L(nm.outputs['Normal'], b.inputs['Normal'])
    _mats[key] = m; return m

def flat(name, rgb, rough=0.7):
    key = (name, rgb)
    if key in _mats: return _mats[key]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough
    _mats[key] = m; return m

def _obj(name, bm, mat, parent, col):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat); o = bpy.data.objects.new(name, me); col.objects.link(o); o.parent = parent; return o

def box(name, x0, x1, y0, y1, z0, z1, mat, parent, col):
    bm = bmesh.new(); v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)): bm.faces.new([v[i] for i in f])
    return _obj(name, bm, mat, parent, col)

def prism(name, x0, x1, y0, y1, z0, rise, mat, parent, col):
    """the gable walls: a triangular prism over the walls, ridge along y"""
    xm = (x0 + x1) / 2; bm = bmesh.new()
    v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (xm, y0, z0 + rise), (x0, y1, z0), (x1, y1, z0), (xm, y1, z0 + rise))]
    for f in ((0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)): bm.faces.new([v[i] for i in f])
    return _obj(name, bm, mat, parent, col)

def roof(name, w, d, z0, pitch_deg, eave_side, eave_gable, thick, mat, parent, col):
    """two roof slabs with deep eaves, ridge along y"""
    half = w / 2 + eave_side; rise = (w / 2) * math.tan(math.radians(pitch_deg)); drop = eave_side * math.tan(math.radians(pitch_deg))
    y0, y1 = -d / 2 - eave_gable, d / 2 + eave_gable; zr = z0 + rise; ze = z0 - drop
    for s in (-1, 1):
        bm = bmesh.new(); xa, xb = 0.0, s * half
        top = [bm.verts.new(p) for p in ((xa, y0, zr + thick), (xb, y0, ze + thick), (xb, y1, ze + thick), (xa, y1, zr + thick))]
        bot = [bm.verts.new(p) for p in ((xa, y0, zr), (xb, y0, ze), (xb, y1, ze), (xa, y1, zr))]
        for f in ((0, 1, 2, 3),): bm.faces.new([top[i] for i in f] if s > 0 else [top[i] for i in reversed(f)])
        bm.faces.new([bot[i] for i in (3, 2, 1, 0)] if s > 0 else [bot[i] for i in (0, 1, 2, 3)])
        for a, b in ((0, 1), (1, 2), (2, 3), (3, 0)): bm.faces.new([top[a], top[b], bot[b], bot[a]] if s > 0 else [bot[a], bot[b], top[b], top[a]])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces); _obj(f'{name} {s}', bm, mat, parent, col)
    return rise

def farmhouse(name, col, w=11.0, d=13.0, ground=3.0, upper=2.7, pitch=24, wall_tint=(1.0, 0.96, 0.88), shutter=(0.16, 0.24, 0.16), seed=0, chimney=True, balcony=True):
    """front gable faces -y. Returns the parent empty (origin at ground level, centre of the footprint)."""
    import random; rnd = random.Random(seed)
    root = bpy.data.objects.new(name, None); col.objects.link(root)
    plaster = material('House plaster', 'white_plaster_rough_01', 2.0, wall_tint, 1.0, 0.8); stone = material('Stone base', 'rustic_stone_wall', 2.2, (0.9, 0.88, 0.84))
    boards = material('Old larch boards', 'weathered_planks', 2.4, (0.5, 0.36, 0.25), 1.0, 0.9); slates = material('Roof shingles', 'roof_slates_02', 2.0, (0.55, 0.47, 0.4), 1.0, 1.0)
    glass = flat('Window glass', (0.03, 0.035, 0.04), 0.15); shut = flat('Shutters', shutter, 0.6); flowers = flat('Geraniums', (0.75, 0.08, 0.1), 0.6); door_m = flat('Old door', (0.22, 0.13, 0.07), 0.7)
    hw, hd = w / 2, d / 2
    box(name + ' plinth', -hw - 0.05, hw + 0.05, -hd - 0.05, hd + 0.05, -5.0, 0.45, stone, root, col)  # the stone plinth takes the slope
    box(name + ' ground floor', -hw, hw, -hd, hd, 0.45, ground, plaster, root, col)
    box(name + ' upper floor', -hw - 0.08, hw + 0.08, -hd - 0.08, hd + 0.08, ground, ground + upper, boards, root, col)
    rise = prism(name + ' gable', -hw - 0.08, hw + 0.08, -hd - 0.08, hd + 0.08, ground + upper, (hw + 0.08) * math.tan(math.radians(pitch)), boards, root, col)
    roof(name + ' roof', w + 0.16, d + 0.16, ground + upper + 0.02, pitch, 1.3, 1.6, 0.22, slates, root, col)
    # windows: small, deep-set, shuttered; flower boxes on the upper floor
    def window(x, y, z, face, wwin=0.9, hwin=1.05, flower=False):
        if face == 'front':
            box(name + ' win', x - wwin / 2, x + wwin / 2, y - 0.06, y + 0.02, z, z + hwin, glass, root, col)
            for s in (-1, 1): box(name + ' shutter', x + s * (wwin / 2 + 0.02) - (0.45 if s < 0 else 0), x + s * (wwin / 2 + 0.02) + (0.45 if s > 0 else 0), y - 0.1, y - 0.04, z - 0.03, z + hwin + 0.03, shut, root, col)
            if flower: box(name + ' flowers', x - wwin / 2 - 0.1, x + wwin / 2 + 0.1, y - 0.4, y - 0.05, z - 0.25, z + 0.05, flowers, root, col)
        else:
            sx = 1 if face == 'right' else -1
            box(name + ' win', x - 0.02, x + 0.06, y - wwin / 2, y + wwin / 2, z, z + hwin, glass, root, col) if sx > 0 else box(name + ' win', x - 0.06, x + 0.02, y - wwin / 2, y + wwin / 2, z, z + hwin, glass, root, col)
            for s in (-1, 1): box(name + ' shutter', x + sx * 0.04, x + sx * 0.1, y + s * (wwin / 2 + 0.02) - (0.45 if s < 0 else 0), y + s * (wwin / 2 + 0.02) + (0.45 if s > 0 else 0), z - 0.03, z + hwin + 0.03, shut, root, col)
    fy = -hd - 0.01
    for x in ([-hw * 0.55, hw * 0.55] if w < 11 else [-hw * 0.62, 0.0, hw * 0.62]): window(x, fy, 1.3, 'front')
    for x in ([-hw * 0.45, hw * 0.45]): window(x, fy - 0.08, ground + 0.75, 'front', flower=True)
    box(name + ' door', -0.55 + hw * 0.2, 0.55 + hw * 0.2, fy - 0.05, fy + 0.02, 0.45, 2.55, door_m, root, col) if w >= 11 else None
    for y in (-hd * 0.5, hd * 0.2):
        for sx in (-1, 1): window(sx * (hw + 0.01), y, 1.3, 'right' if sx > 0 else 'left'); window(sx * (hw + 0.09), y, ground + 0.75, 'right' if sx > 0 else 'left')
    if balcony:  # the gable balcony: a board floor and a rail of planks
        by = -hd - 0.08; z = ground + upper + 0.15
        box(name + ' balcony', -hw + 0.6, hw - 0.6, by - 1.25, by, z, z + 0.14, boards, root, col)
        box(name + ' rail', -hw + 0.6, hw - 0.6, by - 1.25, by - 1.15, z + 0.14, z + 1.05, boards, root, col)
    if chimney:
        cx = hw * 0.35 * (1 if rnd.random() < 0.5 else -1); cy = hd * 0.25; ztop = ground + upper + (hw - abs(cx)) * math.tan(math.radians(pitch)) + 1.4
        box(name + ' chimney', cx - 0.45, cx + 0.45, cy - 0.45, cy + 0.45, ground + upper - 0.3, ztop, stone, root, col)
        root['chimney_top'] = (cx, cy, ztop)
    return root

def barn(name, col, w=7.0, d=8.0, base=2.2, upper=3.0, pitch=28, seed=0):
    """a stadel: dark boards on a stone base, a hay door, a shingled roof"""
    root = bpy.data.objects.new(name, None); col.objects.link(root)
    stone = material('Stone base', 'rustic_stone_wall', 2.2, (0.9, 0.88, 0.84)); boards = material('Barn boards', 'weathered_planks', 2.4, (0.4, 0.29, 0.2), 1.0, 0.9)
    slates = material('Roof shingles', 'roof_slates_02', 2.0, (0.55, 0.47, 0.4), 1.0, 1.0); door_m = flat('Old door', (0.22, 0.13, 0.07), 0.7)
    hw, hd = w / 2, d / 2
    box(name + ' base', -hw, hw, -hd, hd, -5.0, base, stone, root, col)
    box(name + ' boards', -hw - 0.06, hw + 0.06, -hd - 0.06, hd + 0.06, base, base + upper, boards, root, col)
    prism(name + ' gable', -hw - 0.06, hw + 0.06, -hd - 0.06, hd + 0.06, base + upper, (hw + 0.06) * math.tan(math.radians(pitch)), boards, root, col)
    roof(name + ' roof', w + 0.12, d + 0.12, base + upper + 0.02, pitch, 0.9, 1.0, 0.18, slates, root, col)
    box(name + ' hay door', -1.0, 1.0, -hd - 0.1, -hd - 0.04, base + 0.4, base + 2.4, door_m, root, col)
    return root
