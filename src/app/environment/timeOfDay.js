import * as THREE from 'three';

// Time of day for the living world: an artistically controlled solar cycle driven by the device clock, date and timezone (no location needed).
// The four moods (morning, afternoon, evening, night) are colour anchors blended continuously by solar elevation along a rising (morning) and a
// setting (evening) timeline, so there are no presets and no fixed-hour palette swaps. "Approved" keeps the earlier renderer for comparison.
const DEG = Math.PI / 180;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const wrapHour = (hour) => ((Number(hour) % 24) + 24) % 24;
export const hourOf = (date) => date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
export const dayOfYear = (date) => Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);

// ---- astronomy-lite: believable, not geographic
export function solarDay(date) {
  const season = Math.sin((2 * Math.PI * (dayOfYear(date) - 80)) / 365); const dayLength = 12 + 2.4 * season; const noon = 12.75;
  return { dayLength, noon, sunrise: noon - dayLength / 2, sunset: noon + dayLength / 2, maxElevation: 50 + 14 * season };
}
// The sun rises behind and to the left of the camera, climbs through the open sky and sets in front, behind the mountains.
export function sunPose(date) {
  const solar = solarDay(date); const h = hourOf(date); const into = (((h - solar.sunrise) % 24) + 24) % 24; let elevation, azimuth;
  if (into <= solar.dayLength) { const f = into / solar.dayLength; elevation = solar.maxElevation * Math.sin(Math.PI * f); azimuth = (160 - 230 * f) * DEG; }
  else { const g = (into - solar.dayLength) / (24 - solar.dayLength); elevation = -45 * Math.sin(Math.PI * g); azimuth = (-70 - 230 * g) * DEG; }
  const e = elevation * DEG; return { elevation, azimuth, solar, hour: h, dir: [Math.cos(e) * Math.cos(azimuth), Math.sin(e), Math.cos(e) * Math.sin(azimuth)] };
}
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); const SYNODIC = 29.530588853;
export const moonPhase = (date) => ((((date.getTime() - NEW_MOON) / 86400000 / SYNODIC) % 1) + 1) % 1; // 0 new, 0.25 first quarter, 0.5 full
export const moonIllumination = (phase) => (1 - Math.cos(2 * Math.PI * phase)) / 2;
// The moon crosses the open western sky in front of the camera (low enough to be seen) and keeps to the calendar phase: a full moon rises near sunset.
export function moonPose(date, sun) {
  const phase = moonPhase(date); const rise = (sun.solar.sunrise + phase * 24.84) % 24; const into = (((sun.hour - rise) % 24) + 24) % 24; const arc = 12.4; let elevation, azimuth;
  if (into <= arc) { const f = into / arc; elevation = 18 * Math.sin(Math.PI * f); azimuth = (-122 + 64 * f) * DEG; }
  else { const g = (into - arc) / (24 - arc); elevation = -30 * Math.sin(Math.PI * g); azimuth = (-58 - 64 * g) * DEG; }
  const e = elevation * DEG; return { phase, illumination: moonIllumination(phase), elevation, dir: [Math.cos(e) * Math.cos(azimuth), Math.sin(e), Math.cos(e) * Math.sin(azimuth)] };
}

// ---- mood anchors. Numbers: sunK (direct light vs. the approved sun), glowK (sun halo), beltK (rose band opposite the sun), hemiK (sky fill), env (environment light),
// exp (exposure), fogK (haze density), cover (clouds), stars, glow (window light), moon (moon presence). Colours are linear-light blended.
const C = ['zen', 'hor', 'belt', 'sunC', 'hemiSky', 'ground', 'fog', 'cloud']; const N = ['sunK', 'glowK', 'beltK', 'hemiK', 'env', 'exp', 'fogK', 'cover', 'stars', 'glow', 'moon'];
const stop = (e, v) => { const out = { e }; for (const k of C) out[k] = new THREE.Color(v[k]); for (const k of N) out[k] = v[k]; return out; };
const NIGHT = { zen: '#162650', hor: '#2c3f70', belt: '#2c3f70', sunC: '#d98aa0', hemiSky: '#6179b0', ground: '#58786a', fog: '#2a3961', cloud: '#4c5d8c', sunK: 0, glowK: 0, beltK: 0, hemiK: 0.42, env: 0.34, exp: 1.42, fogK: 1, cover: 0.38, stars: 1, glow: 1, moon: 1 };
const DAY = { zen: '#2f7fdc', hor: '#9fc8f0', belt: '#cfe2f1', sunC: '#fff4e2', hemiSky: '#c7dbee', ground: '#8d9d6c', fog: '#cfdeea', cloud: '#ffffff', sunK: 1, glowK: 0.35, beltK: 0, hemiK: 0.28, env: 0.85, exp: 1, fogK: 1, cover: 0.5, stars: 0, glow: 0, moon: 0 };
const EVENING = [
  stop(-18, NIGHT),
  stop(-10, { zen: '#2d3d73', hor: '#6d73a2', belt: '#5e5f96', sunC: '#ff8a78', hemiSky: '#6578aa', ground: '#5e7a62', fog: '#47517e', cloud: '#6a77a6', sunK: 0, glowK: 0.2, beltK: 0.3, hemiK: 0.45, env: 0.3, exp: 1.32, fogK: 1, cover: 0.5, stars: 0.75, glow: 1, moon: 1 }),
  stop(-7.5, { zen: '#3b4c85', hor: '#8c7ba6', belt: '#a67ea4', sunC: '#ff8f76', hemiSky: '#8083b0', ground: '#68805f', fog: '#6f6a95', cloud: '#9a7eaa', sunK: 0.01, glowK: 0.5, beltK: 0.45, hemiK: 0.4, env: 0.27, exp: 1.27, fogK: 1.02, cover: 0.54, stars: 0.5, glow: 0.95, moon: 0.8 }),
  stop(-5, { zen: '#4b5c96', hor: '#b88aa4', belt: '#b887ab', sunC: '#ff9a6e', hemiSky: '#9a8fb6', ground: '#6f8566', fog: '#9d89a8', cloud: '#b384ab', sunK: 0.03, glowK: 0.8, beltK: 0.6, hemiK: 0.32, env: 0.24, exp: 1.22, fogK: 1.05, cover: 0.58, stars: 0.3, glow: 0.9, moon: 0.6 }),
  stop(-2.5, { zen: '#5a6fa8', hor: '#e8927e', belt: '#d092ab', sunC: '#ff9d72', hemiSky: '#b698b2', ground: '#778462', fog: '#c09aa8', cloud: '#d088a8', sunK: 0.1, glowK: 1.1, beltK: 0.68, hemiK: 0.31, env: 0.3, exp: 1.17, fogK: 1.08, cover: 0.59, stars: 0.1, glow: 0.7, moon: 0.35 }),
  stop(0, { zen: '#6d82b8', hor: '#f79f70', belt: '#e49aae', sunC: '#ffa070', hemiSky: '#cfa3ae', ground: '#7d8a62', fog: '#d6a2a6', cloud: '#e690aa', sunK: 0.22, glowK: 1.35, beltK: 0.75, hemiK: 0.3, env: 0.36, exp: 1.12, fogK: 1.1, cover: 0.6, stars: 0, glow: 0.55, moon: 0.2 }),
  stop(6, { zen: '#6f95d6', hor: '#ff9d66', belt: '#f08f9a', sunC: '#ffbe84', hemiSky: '#e5bba8', ground: '#8b925f', fog: '#ebc0a6', cloud: '#f79aa8', sunK: 0.82, glowK: 1.4, beltK: 0.6, hemiK: 0.36, env: 0.56, exp: 1.04, fogK: 1.15, cover: 0.58, stars: 0, glow: 0.15, moon: 0 }),
  stop(14, { zen: '#5a8ed4', hor: '#f6c294', belt: '#f0a894', sunC: '#ffd2a0', hemiSky: '#e3cdb8', ground: '#8e9462', fog: '#ecd0b8', cloud: '#ffd0c0', sunK: 0.95, glowK: 0.9, beltK: 0.3, hemiK: 0.34, env: 0.74, exp: 1, fogK: 1.1, cover: 0.54, stars: 0, glow: 0, moon: 0 }),
  stop(26, { zen: '#3a85dc', hor: '#b4d2ee', belt: '#b4d2ee', sunC: '#fff0d6', hemiSky: '#cddbe8', ground: '#8e9b68', fog: '#d6e0e6', cloud: '#fff6ec', sunK: 0.98, glowK: 0.5, beltK: 0, hemiK: 0.27, env: 0.82, exp: 1, fogK: 1, cover: 0.5, stars: 0, glow: 0, moon: 0 }),
  stop(40, DAY),
];
const MORNING = [
  stop(-18, NIGHT),
  stop(-8, { zen: '#3d4f88', hor: '#9ca2c2', belt: '#c6a9bb', sunC: '#c9a0b0', hemiSky: '#7f8cb6', ground: '#68826a', fog: '#7c86ac', cloud: '#8b93bb', sunK: 0, glowK: 0.1, beltK: 0.4, hemiK: 0.42, env: 0.3, exp: 1.3, fogK: 1.4, cover: 0.35, stars: 0.5, glow: 0.9, moon: 0.5 }),
  stop(1, { zen: '#7d9ccf', hor: '#f6cdb4', belt: '#f5b4a6', sunC: '#ffd6c0', hemiSky: '#c4cfe6', ground: '#7f9a74', fog: '#dccdd0', cloud: '#fbd2c4', sunK: 0.2, glowK: 0.7, beltK: 0.85, hemiK: 0.3, env: 0.3, exp: 1.16, fogK: 1.5, cover: 0.5, stars: 0.08, glow: 0.6, moon: 0.15 }),
  stop(7, { zen: '#5f98e2', hor: '#e6d6ca', belt: '#f4b4a6', sunC: '#fff0de', hemiSky: '#d2e1ee', ground: '#8da676', fog: '#dde8ef', cloud: '#fff1e4', sunK: 0.7, glowK: 0.8, beltK: 0.7, hemiK: 0.3, env: 0.55, exp: 1.06, fogK: 1.35, cover: 0.5, stars: 0, glow: 0.3, moon: 0 }),
  stop(14, { zen: '#4a8fe0', hor: '#c2dcf0', belt: '#c2dcf0', sunC: '#fff3e2', hemiSky: '#cbdcec', ground: '#8ea36f', fog: '#d6e5ee', cloud: '#ffffff', sunK: 0.9, glowK: 0.45, beltK: 0.1, hemiK: 0.28, env: 0.75, exp: 1.02, fogK: 1.1, cover: 0.5, stars: 0, glow: 0, moon: 0 }),
  stop(26, { zen: '#3a85dc', hor: '#b4d2ee', belt: '#b4d2ee', sunC: '#fff0d6', hemiSky: '#cddbe8', ground: '#8e9b68', fog: '#d6e0e6', cloud: '#fff6ec', sunK: 0.98, glowK: 0.5, beltK: 0, hemiK: 0.27, env: 0.82, exp: 1, fogK: 1, cover: 0.5, stars: 0, glow: 0, moon: 0 }),
  stop(40, DAY),
];
function sample(stops, e) {
  if (e <= stops[0].e) return stops[0]; const last = stops[stops.length - 1]; if (e >= last.e) return last;
  for (let i = 0; i < stops.length - 1; i += 1) if (e <= stops[i + 1].e) return mixStops(stops[i], stops[i + 1], (() => { const t = (e - stops[i].e) / (stops[i + 1].e - stops[i].e); return 0.5 * t + 0.5 * smooth(0, 1, t); })());
  return last;
}
function mixStops(a, b, t) { const out = {}; for (const k of C) out[k] = a[k].clone().lerp(b[k], t); for (const k of N) out[k] = a[k] + (b[k] - a[k]) * t; return out; }

// Everything the renderer needs for one moment.
export function moodState(date) {
  const sun = sunPose(date); const moon = moonPose(date, sun); const evening = smooth(sun.solar.noon - 1.5, sun.solar.noon + 1.5, sun.hour);
  const m = mixStops(sample(MORNING, sun.elevation), sample(EVENING, sun.elevation), evening);
  const moonVisible = smooth(-1, 6, moon.elevation) * clamp01(m.moon);
  const e = sun.elevation; const gain = e <= -12 ? 0.32 : e <= -4 ? 0.32 + 0.6 * ((e + 12) / 8) : e <= 4 ? 0.92 + 0.13 * ((e + 4) / 8) : e <= 18 ? 1.05 - 0.07 * ((e - 4) / 14) : 0.98;
  // valley mist: thickest just after sunrise, gone by mid-morning; only a trace at dusk
  const morningMist = smooth(-6, 0, e) * (1 - smooth(5, 22, e)), duskMist = 0.2 * smooth(-9, -3, e) * (1 - smooth(-1, 6, e)); const mist = (1 - evening) * morningMist + evening * duskMist;
  const mistColor = m.hor.clone().lerp(new THREE.Color(1, 1, 1), 0.4).multiplyScalar(0.55 + 0.45 * clamp01(gain));
  return { ...m, gain, mist, mistColor, sun, moon, moonVisible, moonLight: moonVisible * (0.25 + 0.75 * moon.illumination), cloudShift: (sun.hour + dayOfYear(date) * 0.7) * 0.25 };
}

// ---- store (mode: approved | manual | live)
const pad = (n) => String(n).padStart(2, '0');
export const todayString = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const listeners = new Set(); let state = { mode: 'approved', hour: 12, date: todayString() };
const emit = () => listeners.forEach((l) => l());
export const getTod = () => state;
export function setTod(next) {
  const mode = ['approved', 'manual', 'live'].includes(next.mode) ? next.mode : state.mode;
  const hour = Number.isFinite(Number(next.hour)) ? wrapHour(next.hour) : state.hour; const date = /^\d{4}-\d{2}-\d{2}$/.test(next.date ?? '') ? next.date : state.date;
  if (mode === state.mode && hour === state.hour && date === state.date) return; state = { mode, hour, date }; emit();
}
export const subscribeTod = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const liveHour = (date = new Date()) => hourOf(date);
export const formatHour = (h) => { const w = wrapHour(h); const hh = Math.floor(w); return `${pad(hh)}:${pad(Math.floor((w - hh) * 60))}`; };
// The moment the scene should show, or null for the untouched approved look.
export function currentMoment(now = new Date()) {
  if (state.mode === 'live') return now; if (state.mode !== 'manual') return null;
  const [y, mo, d] = state.date.split('-').map(Number); const h = Math.floor(state.hour); const mi = Math.floor((state.hour - h) * 60);
  return new Date(y, mo - 1, d, h, mi, Math.floor(((state.hour - h) * 60 - mi) * 60));
}
// ?tod=live | ?tod=19.5 | ?tod=19.5&date=2026-06-21
export function applyTodQuery(search) {
  const q = new URLSearchParams(search); const raw = q.get('tod'); if (!raw) return; const date = q.get('date') ?? undefined;
  if (raw === 'live') setTod({ mode: 'live' }); else if (Number.isFinite(Number(raw))) setTod({ mode: 'manual', hour: Number(raw), date });
}
if (typeof window !== 'undefined') applyTodQuery(window.location.search);

// ---- imperative application to the live scene. Returns the base values (exposure, environment, haze) the look-dev layer should multiply.
export function applyTimeOfDay(scene, ref, date, base) {
  const sun = scene.getObjectByName('sun'), moon = scene.getObjectByName('moon'), hemi = scene.getObjectByName('tod-ambient'), rig = scene.userData.todRig;
  const setGlow = (value) => scene.traverse((o) => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m?.userData?.windowGlow) m.emissiveIntensity = value; });
  const mistLayer = scene.getObjectByName('valley-mist');
  if (date == null) {
    mistLayer?.userData.update?.(null);
    if (sun) { sun.position.set(ref.sunDir[0] * 180, ref.sunDir[1] * 180, ref.sunDir[2] * 180 - 70); sun.color.set(ref.sunColor); sun.userData.baseIntensity = ref.sunEnergy; }
    if (moon) moon.intensity = 0; if (hemi) hemi.intensity = 0; rig?.setActive(false);
    if (scene.fog) scene.fog.color.set(ref.fogColor); setGlow(0); return base;
  }
  const s = moodState(date);
  if (sun) { sun.position.set(s.sun.dir[0] * 180, s.sun.dir[1] * 180, s.sun.dir[2] * 180 - 70); sun.color.copy(s.sunC); sun.userData.baseIntensity = ref.sunEnergy * s.sunK; }
  if (moon) { moon.position.set(s.moon.dir[0] * 180, s.moon.dir[1] * 180, s.moon.dir[2] * 180 - 70); moon.intensity = s.moonLight * 1.1; }
  if (hemi) { hemi.color.copy(s.hemiSky); hemi.groundColor.copy(s.ground); hemi.intensity = s.hemiK * 1.8; }
  rig?.setActive(true); rig?.update(s); mistLayer?.userData.update?.(s);
  if (scene.fog) scene.fog.color.copy(s.fog); setGlow(s.glow * 1.6);
  return { ...base, exposure: base.exposure * s.exp, environmentIntensity: base.environmentIntensity * s.env, fogDensity: base.fogDensity * s.fogK };
}
