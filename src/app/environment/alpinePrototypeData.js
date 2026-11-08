import * as THREE from 'three';

export const ALPINE_ASSET_ROOT = '/assets/environment/alpine-prototype';

// Flower albedo atlases are minified to a few pixels at distance; anisotropic filtering keeps petal texels from averaging into the dark atlas background.
// Swept 1/2/4/8/16 against the Blender frame: the gain saturates at 8 (16 is within 0.1 blur-error of 8), so 8 avoids extra bandwidth on weaker GPUs.
export const FLOWER_ANISOTROPY = 8;

// Ground, mountain, hamlet and tree textures are seen at grazing angles from a low camera. Without anisotropic filtering they smear
// into the stretched, blurry look; 16x keeps the baked detail legible at no measurable GPU cost.
export const TERRAIN_ANISOTROPY = 16;

// Which instanced meshes the planar water reflection may contain. 'full' is the real scene (all grass layers and flowers); 'near' is the
// previous approximation (the two foreground grass layers only).
export const REFLECTION_GRASS_NAME = /^(Foreground arching grass|Low basal meadow foliage|Midground meadow continuation|Meadow to foothill transition) \//;
export const REFLECTION_NEAR_GRASS_NAME = /^(Foreground arching grass|Low basal meadow foliage) \//;
export const REFLECTION_FLOWER_NAME = / LOD \d$/;
export function reflectionSize(bufferWidth) {
  // Sharp enough to resolve the reflected grass, hills and hamlet after ripple distortion: three quarters of the drawing buffer, capped.
  const width = Math.min(2048, Math.max(1024, Math.round((bufferWidth * 0.75) / 16) * 16));
  return [width, Math.round((width * 9) / 16 / 2) * 2];
}

export function setAnisotropy(texture, level) {
  if (!texture || texture.anisotropy === level) return false;
  texture.anisotropy = level; texture.needsUpdate = true;
  return true;
}

// The manifest stores column-major matrices already converted from Blender Z-up.
export function authoredCamera(manifest, aspect) {
  const camera = new THREE.PerspectiveCamera(manifest.camera.fov, aspect, manifest.camera.near, manifest.camera.far);
  const matrix = new THREE.Matrix4().fromArray(manifest.camera.matrix);
  matrix.decompose(camera.position, camera.quaternion, camera.scale);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

export function grassMatrix(record, offset, target = new THREE.Matrix4(), width = record[offset + 4]) {
  const position = new THREE.Vector3(record[offset], record[offset + 2], -record[offset + 1]);
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), record[offset + 3]);
  const scale = new THREE.Vector3(record[offset + 4], record[offset + 5], width);
  return target.compose(position, rotation, scale);
}

export function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

export function inheritedMetadata(object, key) {
  for (let node = object; node; node = node.parent) {
    if (node.userData[key] !== undefined) return node.userData[key];
  }
  return undefined;
}

export function staticWaterNormal() {
  const size = 256;
  const bytes = new Uint8Array(size * size * 4);
  const hash = (x, y, period) => {
    const a = ((x % period) + period) % period;
    const b = ((y % period) + period) % period;
    const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const noise = (u, v, period) => {
    const x = u * period; const y = v * period;
    const a = Math.floor(x); const b = Math.floor(y);
    const sx = THREE.MathUtils.smoothstep(x - a, 0, 1);
    const sy = THREE.MathUtils.smoothstep(y - b, 0, 1);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a, b, period), hash(a + 1, b, period), sx), THREE.MathUtils.lerp(hash(a, b + 1, period), hash(a + 1, b + 1, period), sx), sy);
  };
  const height = (u, v) => noise(u, v, 8) * .65 + noise(u, v, 19) * .25 + noise(u, v, 43) * .1;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size; const v = y / size; const delta = 1 / size;
      const dx = (height(u + delta, v) - height(u - delta, v)) * 3;
      const dy = (height(u, v + delta) - height(u, v - delta)) * 3;
      const normal = new THREE.Vector3(dx, dy, 1).normalize();
      const index = (y * size + x) * 4;
      bytes[index] = Math.round((normal.x * .5 + .5) * 255);
      bytes[index + 1] = Math.round((normal.y * .5 + .5) * 255);
      bytes[index + 2] = Math.round((normal.z * .5 + .5) * 255);
      bytes[index + 3] = 255;
    }
  }  const texture = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}



// Retain authored roots; hand unresolved middle-distance blades to the native canopy atlas.
// A stable root hash selects a subset, so no new placements or camera-time flicker are introduced.
export function keepResolvedGrass(records, offset, camera) {
  const x = records[offset]; const y = records[offset + 1];
  const distance = Math.hypot(x - camera.matrix[12], -y - camera.matrix[14]);
  if (distance <= 32) return true;
  const transition = THREE.MathUtils.smoothstep(distance, 32, 85);
  const probability = THREE.MathUtils.lerp(1, .08, transition);
  const hash = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return hash - Math.floor(hash) < probability;
}

// Distant source blades retain the narrow curved strip using three triangles, not a filled diamond.
export function distantBladeGeometry(source) {
  const p=source.attributes.position; let tip=0,mid=0,peak=0; let tipScore=Infinity,midScore=Infinity;
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const a=Math.abs(x-1)+Math.abs(z)*.5; if(a<tipScore){tipScore=a;tip=i;}
    const b=Math.abs(y-.6)+Math.abs(z)*.1; if(b<midScore){midScore=b;mid=i;}
    if(y>p.getY(peak))peak=i;
  }
  if(p.getY(tip)<.85)mid=peak;
  const geometry=new THREE.BufferGeometry();
  const x=p.getX(mid),y=p.getY(mid),z=p.getZ(mid);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-.5,0,0,.5,x,y,z-.5,x,y,z+.5,1,p.getY(tip),0],3));
  geometry.setIndex([0,2,1,1,2,3,2,4,3]);geometry.computeVertexNormals();return geometry;
}
