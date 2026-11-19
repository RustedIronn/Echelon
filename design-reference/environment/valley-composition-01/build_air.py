"""Valley composition 01, step 6: air between the viewer and the far land - a mist pass mixed toward the horizon's haze in the compositor."""
import bpy
from pathlib import Path
HERE = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'valley_composition_01.blend')); scene = bpy.context.scene
vl = scene.view_layers[0]; vl.use_pass_mist = True
scene.world.mist_settings.start = 350; scene.world.mist_settings.depth = 14000; scene.world.mist_settings.falloff = 'QUADRATIC'
ok = False
try:
    tree = bpy.data.node_groups.new('Valley air', 'CompositorNodeTree'); scene.compositing_node_group = tree; N = tree.nodes; Lk = tree.links.new
    rl = N.new('CompositorNodeRLayers'); out = N.new('NodeGroupOutput'); tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MIX'
    haze = (0.62, 0.74, 0.88, 1.0)
    curve = N.new('ShaderNodeMath'); curve.operation = 'MULTIPLY'; curve.inputs[1].default_value = 0.55
    lt = N.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = 0.999; Lk(rl.outputs['Mist'], lt.inputs[0]); m2 = N.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; Lk(rl.outputs['Mist'], curve.inputs[0]); Lk(curve.outputs[0], m2.inputs[0]); Lk(lt.outputs[0], m2.inputs[1]); Lk(m2.outputs[0], mix.inputs['Factor'])  # the sky keeps its own colour
    Lk(rl.outputs['Image'], mix.inputs[6]); mix.inputs[7].default_value = haze
    Lk(mix.outputs[2], out.inputs[0]); ok = True
except Exception as e:
    print('AIR new-api failed', e)
    scene.use_nodes = True; tree = scene.node_tree; N = tree.nodes; N.clear(); Lk = tree.links.new
    rl = N.new('CompositorNodeRLayers'); comp = N.new('CompositorNodeComposite'); mix = N.new('CompositorNodeMixRGB'); mul = N.new('CompositorNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 0.55
    Lk(rl.outputs['Mist'], mul.inputs[0]); Lk(mul.outputs[0], mix.inputs[0]); Lk(rl.outputs['Image'], mix.inputs[1]); mix.inputs[2].default_value = (0.62, 0.74, 0.88, 1); Lk(mix.outputs[0], comp.inputs[0]); ok = True
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'valley_composition_01.blend'))
scene.render.filepath = str(HERE / 'renders' / 'air-01.png'); bpy.ops.render.render(write_still=True); print('AIR done', ok)
