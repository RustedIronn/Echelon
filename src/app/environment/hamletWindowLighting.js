// A handful of occupied rooms, not an illuminated facade or belfry.
// Coordinates refer to the existing local apertures; no geometry is moved.
export function windowWarmth(building,[x,y,z]) {
  if(building.kind==='chapel')return y<3.1&&Math.abs(z)<.5?.32:y>3&&y<4.8?.22:0;
  const front=z>building.d/2-.3;
  if(building.id==='cottage-a')return front&&x<-.5?.9:0;
  if(building.id==='cottage-b')return front?(y<2?.82:x>.5?.3:0):0;
  if(building.id==='farm-c')return front&&x>.5?.7:x<-building.w/2+.3?.25:0;
  return 0;
}
export function applyWindowWarmth(material) {
  const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    shader.vertexShader='attribute float aWindowWarmth; varying float vWindowWarmth;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWindowWarmth=aWindowWarmth;');
    shader.fragmentShader='varying float vWindowWarmth;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=vWindowWarmth;');
  };
  material.customProgramCacheKey=()=>previousKey.call(material)+'-selective-window-warmth';
}
