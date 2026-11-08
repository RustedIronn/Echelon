import bpy,json
from pathlib import Path
R=Path('D:/Projects/Echelon/design-reference/environment/alpine-composition-01');bpy.ops.wm.open_mainfile(filepath=str(R/'echelon_alpine_composition_01.blend'));t=bpy.data.node_groups['Echelon terrain - meadow rock snow and wet banks'];out={}
for n in t.nodes:
 if n.name.startswith(('rock scanned','rock world','Scanned geological','Alpine rock','Terrain-following snow','Terrain and rock-led snow','Meadow to alpine')):
  rec={'type':n.type,'inputs':{i.name:(list(i.default_value) if hasattr(i.default_value,'__len__') else i.default_value) for i in n.inputs if hasattr(i,'default_value')}}
  if n.type=='TEX_IMAGE':rec.update(image=n.image.name,size=list(n.image.size),colorspace=n.image.colorspace_settings.name,interpolation=n.interpolation,projection=n.projection,projection_blend=n.projection_blend)
  out[n.name]=rec
(R/'mountain_material_inspection.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
