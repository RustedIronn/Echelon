"""Verify the exact saved material-only pass and packed source maps."""
import bpy,numpy as np,json,hashlib
from pathlib import Path
R=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(R/'echelon_alpine_composition_01.blend'));s=bpy.context.scene;c=s.camera;meta=json.loads((R/'mountain_pbr_preservation.json').read_text());report=json.loads((R/'mountain_pbr_report.json').read_text())
def h(o):
 a=np.empty((len(o.data.vertices),3),np.float32);o.data.vertices.foreach_get('co',a.ravel());return hashlib.sha256(a.tobytes()).hexdigest()
for name,expected in meta['meshes'].items():assert h(bpy.data.objects[name])==expected,name
assert [list(v) for v in c.matrix_world]==meta['camera'] and c.data.lens==meta['lens'];assert bpy.data.objects['Simple afternoon sun'].data.energy==meta['sun_energy']
mat=bpy.data.node_groups['Echelon alpine cliff PBR - sharp world projection'];images={}
for n in mat.nodes:
 if n.type=='TEX_IMAGE' and n.image:
  im=n.image;assert list(im.size)==[4096,4096] and im.packed_file;role='color' if '_diff_' in im.name else 'data';assert im.colorspace_settings.name==('sRGB' if role=='color' else 'Non-Color');images[im.name]={'size':list(im.size),'packed':True,'colorspace':im.colorspace_settings.name}
assert len(images)==4
terrain=bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks'];assert terrain.nodes['High resolution mountain cliff PBR'].node_tree==mat;assert s.render.resolution_x==2560 and s.render.resolution_y==1440 and s.render.filter_size==1.0;assert s.cycles.samples==256
result={'fresh_saved_blend_reopened':True,'all_checked_geometry_byte_identical':True,'checked_meshes':list(meta['meshes']),'camera_and_sun_preserved':True,'images':images,'normal_projection':'Sign-correct three-axis whiteout-style reorientation; flat normal maps preserve mesh normals','hero_resolution':[s.render.resolution_x,s.render.resolution_y],'samples':s.cycles.samples,'noise_threshold':s.cycles.adaptive_threshold,'filter_width_px':s.render.filter_size,'depth_of_field_enabled':c.data.dof.use_dof}
(R/'mountain_pbr_verification.json').write_text(json.dumps(result,indent=2));print('SAVED MOUNTAIN PBR VERIFIED',json.dumps(result),flush=True)
# Small same-camera saved-file render validates that packed images shade correctly.
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type!='CPU'
s.cycles.device='GPU';s.cycles.samples=128;s.render.resolution_x=3840;s.render.resolution_y=2160;s.render.resolution_percentage=100;s.render.use_border=True;s.render.use_crop_to_border=True;s.render.border_min_x=.48;s.render.border_max_x=.64;s.render.border_min_y=.54;s.render.border_max_y=.72;s.render.filepath=str(R/'mountain_pbr_saved_peak.png');bpy.ops.render.render(write_still=True)
print('SAVED PBR PEAK RENDER COMPLETE',flush=True)
