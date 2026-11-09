import { SKY_UNIFORMS, SKY_ACTIVE } from './skyShader.js';

// Mountain surface pass. The range keeps its shape and its baked texture; this adds what the texture cannot resolve at 600-1000 m:
// - rock: strata (near-horizontal bands, broken), gullies running down the fall line, and warmer/cooler stone patches, on steep ground only;
// - snow: a crisp edge (the baked snow fades softly into rock), brighter clean snow, and snow lying in gentler hollows above the snowline;
// - foothills: the uniform green broken by rocky outcrops and scree toward the rock line, and a less saturated, varied grass colour;
// - light: less sky fill on shadowed faces, so sunlit and shaded faces separate and the forms read; a slightly stronger creases (AO);
// - air: the far range takes on the horizon colour with distance (aerial perspective), more at its foot than its summits.
// ?mountains=previous compares with the unchanged range.
const NOISE = `
float mdHash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float mdNoise2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(mdHash(i),mdHash(i+vec2(1,0)),f.x),mix(mdHash(i+vec2(0,1)),mdHash(i+vec2(1,1)),f.x),f.y); }
float mdFbm2(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*mdNoise2(p); p=p*2.07+11.3; a*=0.5; } return s; }`;

export function mountainDetailWanted() { return typeof window === 'undefined' || new URLSearchParams(window.location.search).get('mountains') !== 'previous'; }

export function applyMountainDetail(material) {
  const previous = material.onBeforeCompile; const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    shader.uniforms.uMdHor = SKY_UNIFORMS.uHor; shader.uniforms.uMdSky = SKY_ACTIVE; shader.uniforms.uMdGain = SKY_UNIFORMS.uSkyGain; shader.uniforms.uMdSunDir = SKY_UNIFORMS.uSunDir;
    shader.fragmentShader = `uniform vec3 uMdHor; uniform float uMdGain; uniform float uMdSky; uniform vec3 uMdSunDir; float mdRock = 0.0; float mdDist = 0.0; float mdLift = 0.0;\n${NOISE}\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 wp = cameraPosition + transpose(mat3(viewMatrix)) * (-vViewPosition); vec3 wn = normalize(transpose(mat3(viewMatrix)) * normalize(vNormal));
  float slope = 1.0 - clamp(wn.y, 0.0, 1.0); mdDist = length(wp.xz - cameraPosition.xz); float h = wp.y; mdLift = smoothstep(14.0, 40.0, h);
  vec3 base = diffuseColor.rgb; float lum = dot(base, vec3(0.2126, 0.7152, 0.0722)); float mx = max(base.r, max(base.g, base.b)); float sat = (mx - min(base.r, min(base.g, base.b))) / max(mx, 1e-4);
  float isSnow = smoothstep(0.42, 0.6, lum) * (1.0 - smoothstep(0.12, 0.3, sat)) * smoothstep(42.0, 58.0, h); /* only above the snowline: pale sunlit grass lower down is not snow */ float isGreen = smoothstep(0.06, 0.2, (base.g - max(base.r, base.b)) / max(mx, 1e-3));
  mdRock = smoothstep(0.12, 0.32, slope) * (1.0 - isSnow) * mdLift;
  // rock: strata and gullies
  float strata = mdNoise2(vec2(wp.x * 0.02 + wp.z * 0.013, h * 0.55 + mdNoise2(wp.xz * 0.03) * 2.5));
  float gully = mdFbm2(vec2((wp.x + wp.z) * 0.09, h * 0.018));
  float stone = mdFbm2(wp.xz * 0.012);
  vec3 rockTint = mix(vec3(1.02, 0.95, 0.86), vec3(0.86, 0.9, 0.98), stone) * (0.62 + 0.5 * strata) * (0.7 + 0.45 * smoothstep(0.35, 0.7, gully));
  diffuseColor.rgb = mix(diffuseColor.rgb, base * rockTint, mdRock);
  // snow: crisp edge, clean bright snow, and snow lying in hollows above the snowline
  float snowLine = 62.0 + 14.0 * mdFbm2(wp.xz * 0.008);
  float lying = smoothstep(snowLine, snowLine + 8.0, h) * (1.0 - smoothstep(0.35, 0.6, slope)) * smoothstep(0.45, 0.6, mdFbm2(wp.xz * 0.05 + 4.0));
  float snow = clamp(smoothstep(0.38, 0.52, isSnow + 0.15 * (mdNoise2(wp.xz * 0.2) - 0.5)) + lying, 0.0, 1.0) * mdLift;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98) * max(lum, 0.62) / 0.62, snow * 0.75);
  // foothills: break the uniform green with outcrops and scree toward the rock line; vary and calm the colour
  float foot = isGreen * smoothstep(8.0, 22.0, h);
  float outcrop = smoothstep(0.52, 0.66, mdFbm2(wp.xz * 0.035 + 7.0)) * smoothstep(0.08, 0.25, slope);
  float scree = smoothstep(0.62, 0.8, mdFbm2(vec2((wp.x - wp.z) * 0.05, h * 0.06))) * smoothstep(30.0, 50.0, h);
  vec3 grass = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.333))), 0.22) * (0.86 + 0.24 * mdFbm2(wp.xz * 0.02 + 2.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, grass, foot);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.97, 0.9) * dot(base, vec3(0.333)) * (0.85 + 0.35 * mdNoise2(wp.xz * 0.3)), foot * clamp(outcrop + scree, 0.0, 0.85)); } /* grey stone at the grass's own brightness */`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
// faces turned from the sun get less sky fill, so the forms separate; sunlit faces a touch more direct light
reflectedLight.indirectDiffuse *= mix(1.0, 0.6, mdLift); reflectedLight.directDiffuse *= mix(1.0, 1.14, mdLift);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `// aerial perspective: distant rock takes on the horizon colour, more at the foot than at the summits
{ float air = smoothstep(280.0, 1000.0, mdDist) * mix(0.32, 0.14, mdLift);
  if (uMdSky > 0.5) gl_FragColor.rgb = mix(gl_FragColor.rgb, uMdHor * uMdGain * 0.95, air); } // only with the generated sky (it supplies the horizon colour)
#include <fog_fragment>`);
  };
  material.customProgramCacheKey = () => `${previousKey ? previousKey.call(material) : ''}-mountain-detail-1`;
  material.needsUpdate = true; return material;
}
