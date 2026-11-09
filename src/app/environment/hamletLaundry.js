import * as THREE from 'three';
import { HAMLET_LINEN_LINE } from './hamletLayout.js';
import { WIND } from './wind.js';

// One cottage's linen, not an activity system: two small cloths on the existing
// world clock. No timer, physics simulation, texture or additional frame loop.
export function buildLinenGeometry(field, line = HAMLET_LINEN_LINE) {
  const positions = [], normals = [], uvs = [], colors = [], indices = [];
  const dx = line.b[0] - line.a[0], dz = line.b[1] - line.a[1];
  const length = Math.hypot(dx, dz), nx = -dz / length, nz = dx / length;
  const ay = field.at(...line.a) + line.height, by = field.at(...line.b) + line.height;
  for (const [centre, width, height, tint] of [[.38,.66,.8,'#d8d0b8'],[.68,.52,.65,'#c4c6ba']]) {
    const base = positions.length / 3, across = 8, down = 6, color = new THREE.Color(tint);
    for (let j = 0; j <= down; j++) for (let i = 0; i <= across; i++) {
      const u = i / across, v = j / down, t = centre + (u - .5) * width / length;
      const fold = Math.sin(u * Math.PI * 6) * .018 * v;
      positions.push(line.a[0] + dx * t + nx * fold,
        ay + (by - ay) * t - .26 * Math.min(t, 1 - t) - height * v,
        line.a[1] + dz * t + nz * fold);
      normals.push(nx, 0, nz); uvs.push(u, 1 - v);
      const hem = j === down || i === 0 || i === across ? .9 : 1;
      colors.push(color.r * hem, color.g * hem, color.b * hem);
    }
    for (let j = 0; j < down; j++) for (let i = 0; i < across; i++) {
      const a = base + j * (across + 1) + i, b = a + across + 1;
      indices.push(a,b,a+1,a+1,b,b+1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors,3)); geometry.setIndex(indices);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); geometry.boundingSphere.radius += .15;
  return geometry;
}

export function makeHamletLaundry(field) {
  const geometry = buildLinenGeometry(field), line = HAMLET_LINEN_LINE;
  const dx = line.b[0] - line.a[0], dz = line.b[1] - line.a[1], length = Math.hypot(dx,dz);
  const material = new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,side:THREE.DoubleSide});
  material.onBeforeCompile = shader => {
    shader.uniforms.uLinenTime = WIND.time; shader.uniforms.uLinenWind = WIND.strength;
    shader.vertexShader = 'uniform float uLinenTime; uniform float uLinenWind;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
float hang = 1.0-uv.y;
float breeze = sin(uLinenTime*.83+position.x*.31) + .3*sin(uLinenTime*1.27+uv.x*5.0);
float bend = clamp(uLinenWind,0.0,1.0)*hang*hang*.065*breeze;
transformed.xz += vec2(${(-dz/length).toFixed(6)},${(dx/length).toFixed(6)})*bend;
transformed.y += bend*.12;`);
  };
  material.customProgramCacheKey = () => 'hamlet-linen-wind-1';
  material.userData.lookRole = 'hamlet'; material.userData.baseColor = material.color.clone();
  const mesh = new THREE.Mesh(geometry,material); mesh.name = 'Hamlet / cottage linen'; mesh.receiveShadow = true;
  // It is too small to merit another animated shadow draw; the posts still cast.
  return mesh;
}
