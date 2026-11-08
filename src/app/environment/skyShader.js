import * as THREE from 'three';

// The generated sky as shader code and a single shared uniform set, used by the visible sky, the environment light and the water's sky reflection.
// Clouds are a flat layer (no volumetrics): a domain-warped billowy layer with sun-side self shadowing, darker dense cores, brighter thin edges and a
// silver lining toward the sun, plus a thin high cirrus layer.
export const SKY_UNIFORM_GLSL = `
uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uBelt; uniform vec3 uSunC; uniform vec3 uCloudC;
uniform float uBeltK; uniform float uGlowK; uniform float uCover; uniform float uCloudShift; uniform float uStarK; uniform float uMoonVis; uniform float uMoonPhase; uniform float uSkyGain; uniform float uSunDisc;
float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash21(i),hash21(i+vec2(1.0,0.0)),f.x),mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)),f.x),f.y); }
float fbm(vec2 p){ float a=0.5; float s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+17.1; a*=0.5; } return s; }
vec3 skyRadiance(vec3 d){
  float y=d.y;
  vec3 col=mix(uHor,uZen,pow(smoothstep(-0.03,0.50,y),0.65));
  col=mix(col,uHor*0.75,(1.0-smoothstep(-0.25,0.0,y)));
  col=mix(col,uHor,exp(-max(y,0.0)*7.0)*0.3);
  float sd=max(dot(d,uSunDir),0.0); float up=smoothstep(-0.25,0.05,uSunDir.y);
  col+=uSunC*(pow(sd,6.0)*0.10+pow(sd,48.0)*0.7)*uGlowK*up;
  col+=uSunC*smoothstep(0.99970,0.99993,sd)*uGlowK*5.0*uSunDisc;
  // A broad warm band that rises well above the horizon on the sun's side near sunrise and sunset: the tight halo above hides behind the mountains, but the afterglow must be seen over them.
  float band=pow(sd,2.0)*exp(-max(y,0.0)*8.0); col+=uSunC*band*uGlowK*0.35*smoothstep(-0.38,-0.02,uSunDir.y)*(1.0-smoothstep(0.1,0.5,uSunDir.y));
  vec2 hd=normalize(d.xz+vec2(1e-4)); vec2 ad=normalize(-uSunDir.xz+vec2(1e-4));
  float belt=pow(max(dot(hd,ad),0.0),2.5)*exp(-max(y,0.0)*5.2)*uBeltK;
  col=mix(col,uBelt,clamp(belt,0.0,1.0)*0.9);
  float cm=0.0;
  if(y>0.0){
    vec2 p=d.xz/(y+0.16)*1.1+vec2(uCloudShift,0.0);
    vec2 w=vec2(fbm(p*0.8+3.1),fbm(p*0.8+7.7))-0.5;
    float detail=fbm(p*4.5+w*1.7); float n=fbm(p+w*0.9)*0.65+detail*0.35;
    float body=smoothstep(1.0-uCover-0.04,1.0-uCover+0.14,n); cm=body*smoothstep(0.012,0.17,y);
    vec2 sl=normalize(uSunDir.xz+vec2(1e-4)); float n2=fbm(p+sl*0.30+w*0.9)*0.65+detail*0.35;
    float lit=clamp(0.58+(n-n2)*6.0,0.25,1.1); float thick=smoothstep(1.0-uCover,1.0-uCover+0.55,n);
    vec3 shade=mix(uCloudC*0.38,uZen*0.6,0.25);
    vec3 cc=mix(shade,uCloudC*1.08,lit*(0.6+0.4*(1.0-thick)));
    cc+=uSunC*pow(sd,5.0)*(1.0-thick)*0.45*uGlowK*up;
    cc+=uSunC*pow(sd,1.6)*(0.35+0.65*(1.0-thick))*0.2*uGlowK*up*(1.0-smoothstep(0.0,0.55,uSunDir.y));
    col=mix(col,cc,cm*0.94);
    vec2 q=d.xz/(y+0.35)*vec2(0.6,2.4)+vec2(uCloudShift*0.4,0.0);
    float cirrus=smoothstep(0.55,0.85,fbm(q*2.6+w*0.6))*smoothstep(0.08,0.35,y)*0.38*(1.0-cm);
    col=mix(col,mix(uCloudC*1.05,uSunC,0.35*pow(sd,2.0)*(1.0-smoothstep(0.0,0.5,uSunDir.y))),cirrus);
  }
  if(uStarK>0.0 && y>0.0){
    vec3 cell=d*700.0; vec3 id=floor(cell); float h=fract(sin(dot(id,vec3(12.9898,78.233,37.719)))*43758.5453); vec3 f=fract(cell)-0.5;
    float star=step(0.9965,h)*(1.0-smoothstep(0.0,0.38,length(f)))*(0.5+fract(h*37.0)*0.9);
    col+=vec3(0.85,0.92,1.0)*star*uStarK*smoothstep(0.015,0.2,y)*3.0*(1.0-cm);
  }
  if(uStarK>0.0 && y>0.0){ float mw=exp(-pow(dot(d,normalize(vec3(0.55,0.4,-0.75)))*2.6,2.0)); float tex=0.35+0.65*fbm(d.xz/(y+0.4)*2.3); col+=vec3(0.34,0.4,0.62)*mw*tex*uStarK*0.075*smoothstep(0.04,0.4,y)*(1.0-cm); }
  if(uMoonVis>0.0){
    float md=dot(d,uMoonDir);
    if(md>0.9) col+=vec3(0.5,0.58,0.78)*(pow(md,90.0)*0.055+pow(md,24.0)*0.01)*uMoonVis*(1.0-cm*0.7)*smoothstep(0.9,0.97,md);
    if(md>0.98){
      vec3 r=normalize(cross(uMoonDir,vec3(0.0,1.0,0.0))); vec3 u=cross(r,uMoonDir); float rad=0.012; vec2 q=vec2(dot(d,r),dot(d,u))/(rad*md); float q2=dot(q,q);
      if(q2<1.0){
        vec3 n=vec3(q,sqrt(1.0-q2)); float a=6.2831853*uMoonPhase; vec3 L=vec3(sin(a),0.0,-cos(a)); float lit=smoothstep(-0.03,0.14,dot(n,L));
        vec3 mc=mix(vec3(0.05,0.06,0.09),vec3(1.0,0.96,0.86),lit)*(0.88+0.12*fbm(q*5.0));
        col=mix(col,mc*2.4,uMoonVis*(1.0-cm*0.8)*mix(0.08,1.0,lit)); // the unlit side of a thin moon stays almost invisible against a bright sky
      }
      col+=vec3(0.55,0.62,0.8)*pow(max(md,0.0),600.0)*0.12*uMoonVis*(1.0-cm);
    }
  }
  return col*uSkyGain;
}`;

// One shared set: the visible sky, the environment light and the water all read the same values, and `SKY_ACTIVE` says whether the generated sky is in use.
export const SKY_ACTIVE = { value: 0 };
export const SKY_UNIFORMS = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
  uBelt: { value: new THREE.Color() }, uSunC: { value: new THREE.Color() }, uCloudC: { value: new THREE.Color() }, uBeltK: { value: 0 }, uGlowK: { value: 0 }, uCover: { value: 0.4 },
  uCloudShift: { value: 0 }, uStarK: { value: 0 }, uMoonVis: { value: 0 }, uMoonPhase: { value: 0 }, uSkyGain: { value: 1 }, uSunDisc: { value: 0 },
};
export const createSkyUniforms = () => SKY_UNIFORMS;
export function writeSkyUniforms(u, s) {
  u.uSunDir.value.fromArray(s.sun.dir); u.uMoonDir.value.fromArray(s.moon.dir); u.uZen.value.copy(s.zen); u.uHor.value.copy(s.hor); u.uBelt.value.copy(s.belt); u.uSunC.value.copy(s.sunC); u.uCloudC.value.copy(s.cloud);
  u.uBeltK.value = s.beltK; u.uGlowK.value = s.glowK; u.uCover.value = s.cover; u.uCloudShift.value = s.cloudShift; u.uStarK.value = s.stars; u.uMoonVis.value = s.moonVisible; u.uMoonPhase.value = s.moon.phase;
  u.uSunDisc.value = THREE.MathUtils.smoothstep(s.sun.elevation, -1.5, 2.5); u.uSkyGain.value = s.gain;
}
