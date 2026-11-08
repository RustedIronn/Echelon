// Look-dev controls for the isolated prototype. Every default reproduces the current approved look exactly (1 = unchanged,
// except water sharpness which is an offset). Values are applied imperatively to the live scene, so dragging a slider never
// rebuilds geometry or recompiles shaders.
export const LOOK_DEFAULTS = Object.freeze({
  exposure: 1, sun: 1, ambient: 1, fog: 1,
  hamlet: 1, trees: 1, mountains: 1, ground: 1, grassNear: 1, grassFar: 1, flowers: 1,
  waterReflection: 1, waterMurk: 1, waterRipples: 1, waterSharpness: 0, bankWetness: 1,
});

export const LOOK_CONTROLS = Object.freeze([
  { key: 'exposure', group: 'Light', label: 'Exposure', min: 0.5, max: 1.6, step: 0.01, hint: 'Overall brightness before the display transform' },
  { key: 'sun', group: 'Light', label: 'Sun strength', min: 0, max: 2, step: 0.01, hint: 'Direct light and shadow contrast' },
  { key: 'ambient', group: 'Light', label: 'Sky light', min: 0, max: 2, step: 0.01, hint: 'Fill light from the sky (the blue in the shade)' },
  { key: 'fog', group: 'Light', label: 'Haze', min: 0, max: 8, step: 0.05, hint: 'Distance haze toward the horizon' },
  { key: 'hamlet', group: 'Scene', label: 'Hamlet brightness', min: 0.3, max: 2.5, step: 0.01, hint: 'Houses only' },
  { key: 'trees', group: 'Scene', label: 'Spruce brightness', min: 0.3, max: 2.5, step: 0.01, hint: 'Needles and bark of the spruce' },
  { key: 'mountains', group: 'Scene', label: 'Mountains and far hills', min: 0.3, max: 1.8, step: 0.01, hint: 'Terrain beyond the meadow' },
  { key: 'ground', group: 'Scene', label: 'Meadow ground', min: 0.3, max: 1.8, step: 0.01, hint: 'Soil and bank under the grass' },
  { key: 'grassNear', group: 'Vegetation', label: 'Near grass', min: 0.3, max: 1.5, step: 0.01, hint: 'Foreground and low basal grass' },
  { key: 'grassFar', group: 'Vegetation', label: 'Mid and far grass', min: 0.3, max: 1.8, step: 0.01, hint: 'The strip layers (needs the default strip shading)' },
  { key: 'flowers', group: 'Vegetation', label: 'Flower brightness', min: 0.3, max: 3, step: 0.01, hint: 'All flowers' },
  { key: 'waterReflection', group: 'Water', label: 'Reflection strength', min: 0, max: 1.6, step: 0.01, hint: 'Refined water only' },
  { key: 'waterSharpness', group: 'Water', label: 'Reflection sharpness', min: -2, max: 3, step: 0.05, hint: 'Lower is sharper, higher is softer' },
  { key: 'waterMurk', group: 'Water', label: 'Murkiness', min: 0, max: 4, step: 0.02, hint: '0 is glass-clear, higher hides the bed' },
  { key: 'waterRipples', group: 'Water', label: 'Ripple strength', min: 0, max: 4, step: 0.02, hint: 'Surface relief that breaks up reflections' },
  { key: 'bankWetness', group: 'Water', label: 'Wet bank', min: 0, max: 3, step: 0.02, hint: 'Darkness of the soil beside the water' },
]);

const listeners = new Set();
let values = { ...LOOK_DEFAULTS };
let held = false;

const clampTo = (key, value) => {
  const control = LOOK_CONTROLS.find((c) => c.key === key);
  const number = Number(value);
  if (!control || !Number.isFinite(number)) return LOOK_DEFAULTS[key];
  return Math.min(control.max, Math.max(control.min, number));
};
const emit = () => listeners.forEach((listener) => listener());

// What the scene should currently show: the approved defaults while "hold approved" is pressed.
export const getLook = () => (held ? LOOK_DEFAULTS : values);
export const getLookValues = () => values;
export const isApprovedHeld = () => held;
export function setLook(key, value) { if (!(key in LOOK_DEFAULTS)) return; values = { ...values, [key]: clampTo(key, value) }; emit(); }
export function resetLook() { values = { ...LOOK_DEFAULTS }; held = false; emit(); }
export function holdApproved(on) { if (held === on) return; held = on; emit(); }
export function subscribeLook(listener) { listeners.add(listener); return () => listeners.delete(listener); }

// Only the controls that differ from the approved look, so shared settings stay short.
export function changedLook(source = values) {
  const out = {};
  for (const key of Object.keys(LOOK_DEFAULTS)) if (Math.abs(source[key] - LOOK_DEFAULTS[key]) > 1e-9) out[key] = +source[key].toFixed(3);
  return out;
}
export const lookToQuery = (source = values) => Object.entries(changedLook(source)).map(([k, v]) => `${k}:${v}`).join(',');

// ?ld=exposure:1.1,hamlet:1.4 reproduces a saved look.
export function applyLookQuery(search) {
  const raw = new URLSearchParams(search).get('ld');
  if (!raw) return;
  for (const pair of raw.split(',')) { const [key, value] = pair.split(':'); if (key in LOOK_DEFAULTS) values = { ...values, [key]: clampTo(key, value) }; }
  emit();
}

// Imperative application. `base` holds the scene's own starting values so a slider of 1 always means "approved".
export function applyLook({ scene, gl }, look, base) {
  gl.toneMappingExposure = base.exposure * look.exposure;
  scene.environmentIntensity = base.environmentIntensity * look.ambient;
  if (scene.fog) scene.fog.density = base.fogDensity * look.fog;
  const sun = scene.getObjectByName('sun'); if (sun) sun.intensity = (sun.userData.baseIntensity ?? sun.intensity) * look.sun;
  const seen = new Set();
  scene.traverse((object) => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material || seen.has(material)) continue; seen.add(material);
      const role = material.userData?.lookRole;
      if (role && role in look && material.userData.baseColor) material.color.copy(material.userData.baseColor).multiplyScalar(look[role]);
      if (role === 'water' && material.uniforms) {
        const u = material.uniforms; const baseline = material.userData.baseExtinction;
        if (u.uReflectK) u.uReflectK.value = look.waterReflection;
        if (u.uLodBias) u.uLodBias.value = look.waterSharpness;
        if (u.uRippleK) u.uRippleK.value = look.waterRipples;
        if (u.extinction && baseline) u.extinction.value.copy(baseline).multiplyScalar(look.waterMurk);
      }
      const wet = material.userData?.bankWet;
      if (wet?.params) wet.params.x = 1 - (1 - wet.darkness) * look.bankWetness;
    }
  });
}
