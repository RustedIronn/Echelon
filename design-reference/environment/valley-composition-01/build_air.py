"""Valley composition 01, step 6: air between the viewer and the far land - a mist pass mixed toward the horizon's haze in the compositor."""
import bpy
from pathlib import Path
HERE = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'valley_composition_01.blend')); scene = bpy.context.scene
import math, mathutils
# the quiet hour: a low warm sun ahead and to the left, behind the scene (backlight), the sky glowing round it (target 01)
EL, AZ = math.radians(5.0), math.radians(-14.0)
d = mathutils.Vector((math.sin(AZ) * math.cos(EL), math.cos(AZ) * math.cos(EL), math.sin(EL)))
sun = scene.objects['Sun']; sun.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); sun.data.energy = 3.6; sun.data.color = (1.0, 0.8, 0.58); sun.data.angle = math.radians(1.2)
for nd in scene.world.node_tree.nodes:
    if nd.bl_idname == 'ShaderNodeTexSky':
        nd.sun_elevation = EL; nd.sun_rotation = math.atan2(d.x, d.y)  # (checked: this puts the sky's sun where the lamp's light comes from)
        try: nd.sun_disc = True; nd.air_density = 1.5; nd.dust_density = 6.5; nd.sun_size = math.radians(0.9)  # a hazier, warmer evening sky round the sun
        except Exception: pass
scene.view_settings.exposure = 0.45
for nd in scene.world.node_tree.nodes:
    if nd.bl_idname == 'ShaderNodeBackground' and not scene.world.get('lifted'): nd.inputs['Strength'].default_value *= 1.7  # the shadow side gets the sky's light: shadow, not crushed black
scene.world['lifted'] = True
vl = scene.view_layers[0]; vl.use_pass_mist = True
scene.world.mist_settings.start = 350; scene.world.mist_settings.depth = 14000; scene.world.mist_settings.falloff = 'QUADRATIC'
ok = False
try:
    tree = bpy.data.node_groups.new('Valley air', 'CompositorNodeTree'); scene.compositing_node_group = tree; N = tree.nodes; Lk = tree.links.new
    rl = N.new('CompositorNodeRLayers'); out = N.new('NodeGroupOutput'); tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MIX'
    haze = (0.95, 0.84, 0.68, 1.0)  # warm air toward the low sun
    curve = N.new('ShaderNodeMath'); curve.operation = 'MULTIPLY'; curve.inputs[1].default_value = 0.4
    lt = N.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = 0.999; Lk(rl.outputs['Mist'], lt.inputs[0]); m2 = N.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; Lk(rl.outputs['Mist'], curve.inputs[0]); Lk(curve.outputs[0], m2.inputs[0]); Lk(lt.outputs[0], m2.inputs[1]); Lk(m2.outputs[0], mix.inputs['Factor'])  # the sky keeps its own colour
    Lk(rl.outputs['Image'], mix.inputs[6]); mix.inputs[7].default_value = haze
    try:
        gl = N.new('CompositorNodeGlare'); gl.glare_type = 'BLOOM' if 'BLOOM' in [i.identifier for i in gl.bl_rna.properties['glare_type'].enum_items] else 'FOG_GLOW'
        for nm_, val_ in (('Threshold', 1.2), ('Strength', 0.35), ('Size', 0.6)):
            if nm_ in gl.inputs: gl.inputs[nm_].default_value = val_
        Lk(mix.outputs[2], gl.inputs[0]); Lk(gl.outputs[0], out.inputs[0])  # a soft bloom round the sun
    except Exception as e:
        print('AIR glare', e); Lk(mix.outputs[2], out.inputs[0])
    ok = True
except Exception as e:
    print('AIR new-api failed', e)
    scene.use_nodes = True; tree = scene.node_tree; N = tree.nodes; N.clear(); Lk = tree.links.new
    rl = N.new('CompositorNodeRLayers'); comp = N.new('CompositorNodeComposite'); mix = N.new('CompositorNodeMixRGB'); mul = N.new('CompositorNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 0.55
    Lk(rl.outputs['Mist'], mul.inputs[0]); Lk(mul.outputs[0], mix.inputs[0]); Lk(rl.outputs['Image'], mix.inputs[1]); mix.inputs[2].default_value = (0.62, 0.74, 0.88, 1); Lk(mix.outputs[0], comp.inputs[0]); ok = True
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'valley_composition_01.blend'))
scene.render.filepath = str(HERE / 'renders' / 'air-01.png'); bpy.ops.render.render(write_still=True); print('AIR done', ok)
