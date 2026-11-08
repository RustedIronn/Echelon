import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { HeightField } from './hamletGeometry.js';
import { bankLowering } from './bankLowering.js';
import { applyBlenderDisplay } from './alpineParityMaterials.js';

// Morning valley mist: a few soft sheets that follow the ground (a metre or two above it), patchy banks that thicken over the wet ground by the stream, clear near the camera and
// fading into the distance. It is driven by the time of day (moodState().mist): strongest just after sunrise, gone by mid-morning, a trace at dusk.
const VERTEX = `attribute float aDamp; uniform float uLift; varying vec3 vW; varying float vDamp;
void main(){ vec3 p=position; p.y+=uLift; vec4 w=modelMatrix*vec4(p,1.0); vW=w.xyz; vDamp=aDamp; gl_Position=projectionMatrix*viewMatrix*w; }`;
const FRAGMENT = `#include <common>
uniform float uMist; uniform float uLayer; uniform vec3 uColor; uniform vec3 uCam; uniform vec3 uSunDir; uniform vec3 uSunC; uniform float uSunK; varying vec3 vW; varying float vDamp;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=0.5; } return s; }
void main(){
  float d=length(vW.xz-uCam.xz); float near=smoothstep(85.0,145.0,d); float far=1.0-smoothstep(210.0,320.0,d);
  vec2 p=vW.xz*0.017+uLayer*7.3; float n=fb(p+vec2(2.0,5.0))*0.8+fb(p*3.1+7.0)*0.25; float banks=smoothstep(0.44,0.8,n);
  float a=uMist*near*far*banks*(0.25+0.9*vDamp);
  // the mist takes the colour of the light: warmer toward the low sun, cooler away from it
  vec3 view=normalize(vW-uCam); float toward=pow(max(dot(view,uSunDir),0.0),2.5); vec3 tint=mix(uColor,uSunC*0.95,clamp(0.12+0.4*toward,0.0,0.6)*uSunK);
  gl_FragColor=vec4(tint,clamp(a,0.0,0.6));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
const LAYERS = [{ lift: 0.8, k: 1.0 }, { lift: 2.0, k: 0.55 }];

export default function ValleyMist({ farMeta, farRaw, resources }) {
  const built = useMemo(() => {
    const field = new HeightField(farMeta, new Float32Array(farRaw)); const bank = bankLowering.current; const step = 4;
    const x0 = -170, x1 = 170, z0 = -320, z1 = -30; const nx = Math.floor((x1 - x0) / step) + 1, nz = Math.floor((z1 - z0) / step) + 1;
    const positions = new Float32Array(nx * nz * 3), damp = new Float32Array(nx * nz), index = [];
    for (let j = 0; j < nz; j += 1) for (let i = 0; i < nx; i += 1) {
      const x = x0 + i * step, z = z0 + j * step; let y = field.at(x, z); if (bank) y += bank.offsetAt(x, z, y); const q = j * nx + i;
      positions.set([x, y, z], q * 3); const wd = bank?.relief ? bank.relief.waterDistance(x, z) : 1e5; damp[q] = Math.exp(-wd / 28);
    }
    for (let j = 0; j < nz - 1; j += 1) for (let i = 0; i < nx - 1; i += 1) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; index.push(a, c, b, b, c, d); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('aDamp', new THREE.BufferAttribute(damp, 1)); geometry.setIndex(index);
    const group = new THREE.Group(); group.name = 'valley-mist'; group.visible = false; const materials = [];
    LAYERS.forEach((layer, n) => {
      const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uLift: { value: layer.lift }, uMist: { value: 0 }, uLayer: { value: n }, uColor: { value: new THREE.Color('#ffffff') }, uCam: { value: new THREE.Vector3(-3, 4.362932682, 10) }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: new THREE.Color('#ffffff') }, uSunK: { value: 0 } } });
      applyBlenderDisplay(material, resources); const mesh = new THREE.Mesh(geometry, material); mesh.renderOrder = 4; mesh.frustumCulled = false; group.add(mesh); materials.push({ material, k: layer.k });
    });
    group.userData.update = (s) => {
      const amount = s ? s.mist : 0; group.visible = amount > 0.004; if (!s) return;
      for (const { material, k } of materials) { const u = material.uniforms; u.uMist.value = amount * 0.20 * k; u.uColor.value.copy(s.mistColor); u.uSunDir.value.fromArray(s.sun.dir); u.uSunC.value.copy(s.sunC); u.uSunK.value = Math.min(1, Math.max(0, (s.sun.elevation + 6) / 12)); }
    };
    return { group, geometry, materials };
  }, [farMeta, farRaw, resources]);
  useEffect(() => () => { built.geometry.dispose(); built.materials.forEach(({ material }) => material.dispose()); }, [built]);
  return <primitive object={built.group} />;
}
