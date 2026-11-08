"""Compress only opaque baked albedos inside GLBs; retain all geometry and alpha maps.
Uses Blender's bundled image decoder/encoder; no third-party dependencies.
"""
import bpy,json,struct
from pathlib import Path

def optimize(path,cache):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);binary=raw[28+n:];replacements={};count=0
 for image in doc.get('images',[]):
  if image.get('name') not in {'terrain-near','terrain-range','hamlet-atlas'} or image.get('mimeType')=='image/jpeg':continue
  view=doc['bufferViews'][image['bufferView']];name=image['name'];png=cache/(name+'-embedded.png');png.write_bytes(binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]);im=bpy.data.images.load(str(png),check_existing=False);_force=im.pixels[0];im.file_format='JPEG';im.filepath_raw=str(cache/(name+'-delivery.jpg'));im.save();replacements[image['bufferView']]=Path(im.filepath_raw).read_bytes();image['mimeType']='image/jpeg';count+=1;bpy.data.images.remove(im)
 if not replacements:return {'file':path.name,'bytes':len(raw),'convertedOpaqueAlbedos':0}
 data=bytearray()
 for i,view in enumerate(doc['bufferViews']):
  payload=replacements.get(i,binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]);data.extend(b'\0'*((-len(data))%4));view['byteOffset']=len(data);view['byteLength']=len(payload);data.extend(payload)
 data.extend(b'\0'*((-len(data))%4));doc['buffers'][0]['byteLength']=len(data);text=json.dumps(doc,separators=(',',':')).encode();text+=b' '*((-len(text))%4);out=struct.pack('<4sII',b'glTF',2,12+8+len(text)+8+len(data))+struct.pack('<I4s',len(text),b'JSON')+text+struct.pack('<I4s',len(data),b'BIN\0')+data;path.write_bytes(out);return {'file':path.name,'beforeBytes':len(raw),'bytes':len(out),'convertedOpaqueAlbedos':count}

if __name__=='__main__':
 R=Path(__file__).resolve().parent;ROOT=R.parents[2];cache=R/'cache';cache.mkdir(exist_ok=True);report=[optimize(p,cache) for p in (ROOT/'public/assets/environment/alpine-prototype').glob('*.glb')];(R/'packing-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
