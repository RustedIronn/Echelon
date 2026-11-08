"""Render two high-resolution crops from the saved hero camera; never save changes."""
import bpy
from pathlib import Path

root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'echelon_alpine_composition_01.blend'))
scene=bpy.context.scene
scene.render.resolution_x=3200;scene.render.resolution_y=1800;scene.render.resolution_percentage=100
scene.render.use_border=True;scene.render.use_crop_to_border=True
for name,bounds in [('hamlet_detail.png',(.63,.84,.42,.65)),('mountain_detail.png',(.025,.975,.54,.75))]:
    scene.render.border_min_x,scene.render.border_max_x,scene.render.border_min_y,scene.render.border_max_y=bounds
    scene.render.filepath=str(root/name)
    bpy.ops.render.render(write_still=True)
print('DETAIL_CROPS_COMPLETE; saved camera and render settings remain unchanged.')
