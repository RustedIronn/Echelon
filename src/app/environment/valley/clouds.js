import * as THREE from 'three';
import { LOOK } from './look.js';

// A layer of fair-weather cloud at about 2,800 m above the lake (4,300 m above the sea): broken cumulus whose undersides go grey and whose
// edges light up toward the sun (forward scattering, the silver lining), thinning into haze toward the horizon. The Dom's summit can stand
// into it. Drifting slowly with the wind. One large plane, depth-tested, drawn after the land.
export function buildClouds({ coverage = 0.5, night = false } = {}) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uSunDir: LOOK.uSunDir, uSunCol: LOOK.uSunCol, uHaze: LOOK.uHaze, uCover: { value: coverage }, uNight: { value: night ? 1 : 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uHaze; uniform float uCover; uniform float uNight; uniform float uTime; varying vec3 vW;
float h1(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<6;i++){ s+=a*n2(p); p=p*2.02+vec2(5.1,1.7); a*=0.5; } return s; }
void main(){
  vec2 p = vW.xz + vec2(uTime * 6.0, uTime * 2.0);
  vec2 warp = vec2(fb(p / 5000.0), fb(p / 5000.0 + 9.2)) - 0.5;
  float base = fb(p / 3200.0 + warp * 1.6);
  float dens = smoothstep(uCover, uCover + 0.22, base); dens *= 0.65 + 0.35 * fb(p / 700.0 + 3.0);
  vec3 v = normalize(vW - cameraPosition); float d = length(vW - cameraPosition);
  float fade = (1.0 - smoothstep(15000.0, 28500.0, d)) * smoothstep(0.0, 0.035, v.y);
  float a = clamp(dens * 1.25, 0.0, 1.0) * fade; if (a < 0.003) discard;
  float sunUp = smoothstep(-0.08, 0.15, uSunDir.y);
  float thick = smoothstep(0.2, 1.0, dens);
  vec3 lit = mix(uSunCol, vec3(1.0), 0.62) * (1.18 - 0.22 * thick);                         // sunlit tops: bright, a little warm
  lit = mix(lit, vec3(0.74, 0.78, 0.86), thick * 0.45);                                      // the thick middle: a soft blue-grey, not brown
  float fwd = pow(max(dot(v, normalize(uSunDir)), 0.0), 10.0); lit += uSunCol * fwd * (1.0 - thick) * 1.6; // the silver lining toward the sun
  vec3 col = mix(vec3(0.07, 0.08, 0.11), lit, sunUp); if (uNight > 0.5) col = vec3(0.08, 0.1, 0.15);
  col = mix(col, uHaze, smoothstep(0.25, 0.0, v.y) * 0.55);                                  // the far cloud fades into the horizon haze
  gl_FragColor = vec4(col, a);
}`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000, 1, 1), mat); mesh.rotation.x = -Math.PI / 2; mesh.position.set(0, 2800, -20000); mesh.renderOrder = 2; mesh.name = 'cloud layer';
  return mesh;
}
