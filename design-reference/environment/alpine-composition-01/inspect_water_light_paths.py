import bpy
from pathlib import Path
r=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(r/'echelon_alpine_composition_01.blend'));s=bpy.context.scene
for name in ['max_bounces','transmission_bounces','diffuse_bounces','glossy_bounces','volume_bounces','caustics_reflective','caustics_refractive']:
 print('PATHS',name,getattr(s.cycles,name,None),flush=True)
for name in ['Water inside carved channel - static graded surface','Continuous meadow foothills and mountain range','Simple afternoon sun']:
 o=bpy.data.objects[name];print('OBJECT',name,[(p.identifier,getattr(o.cycles,p.identifier,None)) for p in o.cycles.bl_rna.properties if 'caustic' in p.identifier],flush=True)
 if o.type=='LIGHT':print('LIGHT CAUSTICS',[(p.identifier,getattr(o.data.cycles,p.identifier,None)) for p in o.data.cycles.bl_rna.properties if 'caustic' in p.identifier],flush=True)
