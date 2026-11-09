import * as THREE from 'three';
import { WIND } from './wind.js';

// The generated sky as shader code and a single shared uniform set, used by the visible sky, the environment light and the water's sky reflection.
// Clouds are a flat layer (no volumetrics): a domain-warped billowy layer with sun-side self shadowing, darker dense cores, brighter thin edges and a
// silver lining toward the sun, plus a thin high cirrus layer.
export const SKY_UNIFORM_GLSL = `
uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uBelt; uniform vec3 uSunC; uniform vec3 uCloudC;
uniform float uBeltK; uniform float uGlowK; uniform float uCover; uniform float uCloudShift; uniform float uSkyTime; uniform float uStarK; uniform float uMoonVis; uniform float uMoonPhase; uniform float uSkyGain; uniform float uSunDisc; uniform float uMoonIllum;
float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash21(i),hash21(i+vec2(1.0,0.0)),f.x),mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)),f.x),f.y); }
float fbm(vec2 p){ float a=0.5; float s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+17.1; a*=0.5; } return s; }
// The moon's face (q: position on the disc, x right, y up, unit radius): the dark maria in roughly their real places, crater speckle in the
// highlands, and Tycho's bright ray system in the south. Returns albedo, 1 for the bright highlands.
float moonMare(vec2 q, vec2 c, vec2 r, float n){ return 1.0 - smoothstep(0.35, 1.05, length((q - c) / r) + n); }
float moonAlbedo(vec2 q){
  float n = (vnoise(q * 5.0) - 0.5) * 0.7 + (vnoise(q * 13.0) - 0.5) * 0.25;
  float m = moonMare(q, vec2(-0.55, 0.08), vec2(0.30, 0.50), n);            // Oceanus Procellarum
  m = max(m, moonMare(q, vec2(-0.24, 0.44), vec2(0.27, 0.21), n));          // Imbrium
  m = max(m, moonMare(q, vec2(0.17, 0.42), vec2(0.15, 0.14), n));           // Serenitatis
  m = max(m, moonMare(q, vec2(0.32, 0.12), vec2(0.21, 0.17), n));           // Tranquillitatis
  m = max(m, moonMare(q, vec2(0.68, 0.33), vec2(0.10, 0.09), n));           // Crisium
  m = max(m, moonMare(q, vec2(0.55, -0.12), vec2(0.12, 0.17), n));          // Fecunditatis
  m = max(m, moonMare(q, vec2(0.36, -0.22), vec2(0.08, 0.07), n));          // Nectaris
  m = max(m, moonMare(q, vec2(-0.18, -0.30), vec2(0.18, 0.13), n));         // Nubium
  m = max(m, moonMare(q, vec2(-0.48, -0.33), vec2(0.09, 0.08), n));         // Humorum
  m = max(m, moonMare(q, vec2(-0.04, 0.73), vec2(0.42, 0.07), n) * 0.8);    // Frigoris
  float a = mix(1.0, 0.66, m) * (0.9 + 0.14 * vnoise(q * 11.0) + 0.06 * vnoise(q * 27.0));
  vec2 t = q - vec2(-0.12, -0.72); float tl = length(t);                   // Tycho and its rays
  a += 0.4 * exp(-tl * tl * 500.0) + 0.1 * pow(abs(sin(atan(t.y, t.x) * 7.0 + 0.6)), 14.0) * exp(-tl * 2.6) * (1.0 - m);
  vec2 cp = q - vec2(-0.3, 0.16); a += 0.25 * exp(-dot(cp, cp) * 900.0);   // Copernicus
  return a;
}
vec3 skyRadiance(vec3 d){
  float y=d.y;
  vec3 col=mix(uHor,uZen,pow(smoothstep(-0.03,0.50,y),0.65));
  col=mix(col,uHor*0.75,(1.0-smoothstep(-0.25,0.0,y)));
  col=mix(col,uHor,exp(-max(y,0.0)*7.0)*0.3);
  float sd=max(dot(d,uSunDir),0.0); float up=smoothstep(-0.25,0.05,uSunDir.y);
  col+=uSunC*(pow(sd,6.0)*0.10+pow(sd,48.0)*0.7)*uGlowK*up;
  // the sun's disc: crisp, darker toward its limb, a little flattened by refraction near the horizon, bright enough to bloom
  if(sd>0.999){
    vec3 rs=normalize(cross(uSunDir,vec3(0.0,1.0,0.0))+vec3(1e-5)); vec3 us=cross(rs,uSunDir); float squash=1.0-0.16*(1.0-smoothstep(-0.01,0.07,uSunDir.y));
    vec2 sq=vec2(dot(d,rs),dot(d,us)/squash)/0.0105; float sr=length(sq);
    float disc=1.0-smoothstep(0.93,1.0,sr); float limbD=0.58+0.42*sqrt(max(1.0-sr*sr,0.0));
    col+=uSunC*disc*limbD*uGlowK*9.0*uSunDisc;
  }
  // A broad warm band that rises well above the horizon on the sun's side near sunrise and sunset: the tight halo above hides behind the mountains, but the afterglow must be seen over them.
  float band=pow(sd,2.0)*exp(-max(y,0.0)*8.0); col+=uSunC*band*uGlowK*0.35*smoothstep(-0.38,-0.02,uSunDir.y)*(1.0-smoothstep(0.1,0.5,uSunDir.y));
  vec2 hd=normalize(d.xz+vec2(1e-4)); vec2 ad=normalize(-uSunDir.xz+vec2(1e-4));
  float belt=pow(max(dot(hd,ad),0.0),2.5)*exp(-max(y,0.0)*5.2)*uBeltK;
  col=mix(col,uBelt,clamp(belt,0.0,1.0)*0.9);
  float cm=0.0;
  if(y>0.0){
    vec2 p=d.xz/(y+0.16)*1.1+vec2(uCloudShift,0.0)+vec2(0.0035,0.0012)*uSkyTime; // clouds drift across the sky in real time
    vec2 w=vec2(fbm(p*0.8+3.1+uSkyTime*0.0011),fbm(p*0.8+7.7-uSkyTime*0.0009))-0.5; /* and slowly change shape as they go */
    float detail=fbm(p*4.5+w*1.7); float n=fbm(p+w*0.9)*0.65+detail*0.35;
    float body=smoothstep(1.0-uCover-0.04,1.0-uCover+0.14,n); cm=body*smoothstep(0.012,0.17,y);
    vec2 sl=normalize(uSunDir.xz+vec2(1e-4)); float n2=fbm(p+sl*0.30+w*0.9)*0.65+detail*0.35;
    float lit=clamp(0.58+(n-n2)*6.0,0.25,1.1); float thick=smoothstep(1.0-uCover,1.0-uCover+0.55,n);
    vec3 shade=mix(uCloudC*0.38,uZen*0.6,0.25);
    vec3 cc=mix(shade,uCloudC*1.08,lit*(0.6+0.4*(1.0-thick)));
    cc+=uSunC*pow(sd,5.0)*(1.0-thick)*0.45*uGlowK*up;
    cc+=uSunC*pow(sd,1.6)*(0.35+0.65*(1.0-thick))*0.2*uGlowK*up*(1.0-smoothstep(0.0,0.55,uSunDir.y));
    col=mix(col,cc,cm*0.94);
    vec2 q=d.xz/(y+0.35)*vec2(0.6,2.4)+vec2(uCloudShift*0.4,0.0)+vec2(0.0014,0.0)*uSkyTime; // high cirrus drift slower
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
    float night=1.0-smoothstep(-0.1,0.12,uSunDir.y); float low=smoothstep(-0.02,0.3,uMoonDir.y);
    vec3 tint=mix(vec3(1.0,0.74,0.5),vec3(1.0,0.97,0.92),low); // a low moon is warmer and dimmer, seen through more air
    // the glow around the moon (brighter the fuller it is); it also lights the clouds that drift in front of it
    { /* exponential falloffs with no cut-off radius, so the glow has no visible rim */
      float x=max(1.0-md,0.0);
      float glow=(exp(-x*3000.0)*0.08+exp(-x*260.0)*0.022+exp(-x*35.0)*0.006)*uMoonIllum*night;
      col+=tint*vec3(0.66,0.72,0.88)*glow*uMoonVis*(1.0-cm*0.4);
      col+=uCloudC*cm*exp(-x*70.0)*0.3*uMoonIllum*night*uMoonVis; /* silver edges on clouds near the moon */
    }
    if(md>0.98){
      vec3 r=normalize(cross(uMoonDir,vec3(0.0,1.0,0.0))); vec3 u=cross(r,uMoonDir); float rad=0.012; vec2 q=vec2(dot(d,r),dot(d,u))/(rad*md); float q2=dot(q,q);
      float cover=1.0-smoothstep(0.95,1.0,sqrt(q2));
      if(cover>0.0){
        vec3 n=vec3(q,sqrt(max(1.0-q2,0.0)));
        // the bright limb faces the sun (so a dusk crescent tilts toward where the sun went down); the calendar phase sets how much is lit
        vec2 s2=vec2(dot(uSunDir,r),dot(uSunDir,u)); s2=normalize((length(s2)>1e-3?normalize(s2):vec2(1.0,0.0))+vec2(1.1,0.0)); /* leaning toward the sun but mostly sideways, so the terminator never lies flat */
        float a=6.2831853*uMoonPhase; vec3 L=normalize(vec3(s2*abs(sin(a)),-cos(a)));
        float lit=smoothstep(-0.035,0.07,dot(n,L)); float alb=moonAlbedo(q);
        float bright=mix(0.32,2.05,night)*mix(0.5,1.0,low); /* by day a pale ghost of itself; at night bright, but short of clipping so the maria show */
        vec3 surface=tint*alb*(0.84+0.16*n.z)*bright*lit;
        vec3 earthshine=vec3(0.32,0.38,0.52)*alb*0.045*bright*(1.0-smoothstep(0.05,0.3,uMoonIllum))*night*(1.0-lit); // only a crescent shows its dark part, lit by the Earth
        col+=(surface+earthshine)*cover*uMoonVis*(1.0-cm*0.85); // moonlight adds to the sky in front of it: a daytime moon looks washed, as it should
      }
    }
  }
  return col*uSkyGain;
}`;

// One shared set: the visible sky, the environment light and the water all read the same values, and `SKY_ACTIVE` says whether the generated sky is in use.
export const SKY_ACTIVE = { value: 0 };
export const SKY_UNIFORMS = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
  uBelt: { value: new THREE.Color() }, uSunC: { value: new THREE.Color() }, uCloudC: { value: new THREE.Color() }, uBeltK: { value: 0 }, uGlowK: { value: 0 }, uCover: { value: 0.4 },
  uCloudShift: { value: 0 }, uSkyTime: WIND.time, uStarK: { value: 0 }, uMoonVis: { value: 0 }, uMoonPhase: { value: 0 }, uSkyGain: { value: 1 }, uSunDisc: { value: 0 }, uMoonIllum: { value: 0 },
};
export const createSkyUniforms = () => SKY_UNIFORMS;
export function writeSkyUniforms(u, s) {
  u.uSunDir.value.fromArray(s.sun.dir); u.uMoonDir.value.fromArray(s.moon.dir); u.uZen.value.copy(s.zen); u.uHor.value.copy(s.hor); u.uBelt.value.copy(s.belt); u.uSunC.value.copy(s.sunC); u.uCloudC.value.copy(s.cloud);
  u.uBeltK.value = s.beltK; u.uGlowK.value = s.glowK; u.uCover.value = s.cover; u.uCloudShift.value = s.cloudShift; u.uStarK.value = s.stars; u.uMoonVis.value = s.moonDisc ?? s.moonVisible; u.uMoonPhase.value = s.moon.phase; u.uMoonIllum.value = s.moon.illumination ?? 0;
  u.uSunDisc.value = THREE.MathUtils.smoothstep(s.sun.elevation, -1.5, 2.5); u.uSkyGain.value = s.gain;
}
