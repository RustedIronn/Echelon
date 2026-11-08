"""Fresh-file verification of the first vegetation integration, plus an unaltered-camera crop."""
import bpy,json,hashlib,shutil
import numpy as np
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parent
FILE=ROOT/'echelon_alpine_composition_01.blend'
bpy.ops.wm.open_mainfile(filepath=str(FILE));scene=bpy.context.scene
baseline=json.loads((ROOT/'ecosystem_geometry_preservation.json').read_text())
report=json.loads((ROOT/'ecosystem_integration_report.json').read_text())
root=bpy.data.collections['06 Meadow ecosystem - first integration']
owned=set(root.all_objects);checks=[]
assert scene.camera.name==baseline['camera']['name']
assert [list(v) for v in scene.camera.matrix_world]==baseline['camera']['matrix']
assert scene.camera.data.lens==baseline['camera']['lens']
for name,old in baseline['objects'].items():
    ob=bpy.data.objects[name];assert [list(v) for v in ob.matrix_world]==old['matrix'],name
    if ob.type=='MESH':
        coords=np.empty(len(ob.data.vertices)*3,dtype=np.float32);ob.data.vertices.foreach_get('co',coords)
        assert hashlib.sha256(coords.tobytes()).hexdigest()==old['coordinates_sha256'],name
        assert len(ob.data.polygons)==old['polygons'] and [m.name if m else None for m in ob.data.materials]==old['materials'],name
    if ob.type=='LIGHT':assert ob.data.energy==old['energy'] and list(ob.data.color)==old['color']
# Remove only zero-user data left by the integration rebuild. Linked scene data,
# including hidden source objects, are retained and verified above.
bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=True,do_recursive=True)
for name,population in report['flowers'].items():
    ob=bpy.data.objects['Meadow blooms - '+name]
    assert len(ob.data.vertices)==population['count']
    assert not ob.hide_render and not ob.hide_viewport and not ob.hide_get()
    assert ob.modifiers[0].show_viewport and ob.modifiers[0].show_render
    checks.append({'species':name,'saved_root_count':len(ob.data.vertices),'viewport_enabled':True,'render_enabled':True})
deps=bpy.context.evaluated_depsgraph_get();instances=Counter()
for i in deps.object_instances:
    if i.is_instance and i.parent and i.parent.original.name.startswith('Meadow blooms - '):instances[i.parent.original.name]+=1
assert sum(instances.values())==sum(r['count'] for r in report['flowers'].values()),dict(instances)
for key,count in [('Norway Spruce',10387),('Larch',12201)]:
    ob=bpy.data.objects['SOURCE - '+key];ob.data.calc_loop_triangles();assert len(ob.data.loop_triangles)==count
for ob in owned:
    if ob.type!='MESH':continue
    for mat in ob.data.materials:
        if mat and mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type=='TEX_IMAGE' and node.image:assert all(node.image.size) and node.image.packed_file,(ob.name,node.image.name)
report['saved_file_verification']={'fresh_process_reopen':True,'protected_original_objects_verified':len(baseline['objects']),'terrain_water_grass_hamlet_camera_lights_unchanged':True,'flower_emitters':checks,'evaluated_viewport_flower_instances':dict(instances),'tree_objects':len(bpy.data.collections['Authored trees and saplings - individual placements'].objects),'new_source_maps_packed':True}
# Save a normal camera-view startup with the camera selected, not a hidden source.
bpy.ops.object.select_all(action='DESELECT');scene.camera.select_set(True);bpy.context.view_layer.objects.active=scene.camera
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
report['saved_file_verification']['saved_size_bytes']=FILE.stat().st_size
(ROOT/'ecosystem_integration_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
shutil.copyfile(ROOT/'ecosystem_integration_preview.png',ROOT/'composition_preview.png')
print('VERIFIED',json.dumps(report['saved_file_verification']),flush=True)
# Render a larger crop from exactly the same hero camera. These temporary crop
# settings are deliberately not saved into the canonical blend.
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
    for d in prefs.devices:d.use=d.type!='CPU'
    scene.cycles.device='GPU'
except Exception:scene.cycles.device='CPU'
scene.cycles.samples=128;scene.cycles.use_denoising=True
scene.render.resolution_x=2560;scene.render.resolution_y=1440;scene.render.resolution_percentage=100
scene.render.use_border=True;scene.render.use_crop_to_border=True
scene.render.border_min_x=.015;scene.render.border_max_x=.60;scene.render.border_min_y=0;scene.render.border_max_y=.32
scene.render.filepath=str(ROOT/'ecosystem_foreground_detail.png');bpy.ops.render.render(write_still=True)
print('HERO FOREGROUND CROP COMPLETE',flush=True)
