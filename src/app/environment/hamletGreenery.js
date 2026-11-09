import * as THREE from 'three';
import { applyBlenderDisplay, applyFoliageStyle } from './alpineParityMaterials.js';
import { HAMLET_SHELTER } from './hamletLayout.js';

// One shelter tree belongs to the settlement. Reuse the delivered Norway spruce
// geometry and textures; only its transform and materials are owned here.
export function buildHamletShelter(landscape, field, resources) {
  let source=null;
  landscape?.traverse(object=>{if(!source&&object.userData.echelonRole==='tree')source=object;});
  if(!source)return null;
  const site=HAMLET_SHELTER,y=field.at(site.x,site.z);if(!Number.isFinite(y))return null;
  const tree=source.clone(true);tree.position.set(0,0,0);tree.quaternion.identity();tree.scale.setScalar(1);
  const box=new THREE.Box3().setFromObject(tree),height=box.max.y-box.min.y;
  if(!(height>0))return null;
  const scale=site.height/height;
  tree.scale.setScalar(scale);tree.position.set(-(box.min.x+box.max.x)*.5*scale,-box.min.y*scale,-(box.min.z+box.max.z)*.5*scale);
  const group=new THREE.Group();group.name='Hamlet / shelter spruce';group.position.set(site.x,y,site.z);group.rotation.y=site.yaw;group.add(tree);group.updateMatrixWorld(true);
  const center=new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3()),materials=new Map();
  tree.traverse(object=>{
    if(!object.isMesh)return;
    const copy=original=>{
      if(materials.has(original))return materials.get(original);
      const material=original.clone();
      if(original.userData.baseColor)material.color.copy(original.userData.baseColor);
      material.transparent=false;material.alphaTest=.3;material.alphaToCoverage=true;material.side=THREE.DoubleSide;
      material.roughness=.95;applyBlenderDisplay(material,resources);applyFoliageStyle(material,center);
      material.userData.lookRole='trees';material.userData.baseColor=material.color.clone();materials.set(original,material);return material;
    };
    object.material=Array.isArray(object.material)?object.material.map(copy):copy(object.material);
    object.castShadow=true;object.receiveShadow=true;
  });
  return{group,dispose:()=>materials.forEach(material=>material.dispose())}; // shared geometry and textures stay owned by the landscape
}
