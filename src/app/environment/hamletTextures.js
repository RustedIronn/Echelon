import * as THREE from 'three';
import { mulberry32 } from './hamletLayout.js';

// Small tiling canvas textures for the procedural hamlet. They are multiplied with the vertex colours (the palette), so each one is a
// light, mostly-neutral pattern (values mostly 0.78..1.0) that adds grain, mortar lines, tile rows or planks without changing the hue.
const SIZE = 256;

function canvasTexture(draw, seed, repeatHint = 1) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE; const g = canvas.getContext('2d'); const rng = mulberry32(seed);
  g.fillStyle = '#fff'; g.fillRect(0, 0, SIZE, SIZE); draw(g, rng);
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  texture.userData.repeatHint = repeatHint; return texture;
}
const gray = (v) => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; };
function speckle(g, rng, count, low, high, size = 2) { for (let i = 0; i < count; i += 1) { g.fillStyle = gray(low + rng() * (high - low)); g.fillRect(rng() * SIZE, rng() * SIZE, 1 + rng() * size, 1 + rng() * size); } }
function wrapRect(g, x, y, w, h) { for (const ox of [0, -SIZE]) for (const oy of [0, -SIZE]) g.fillRect(x + ox, y + oy, w, h); }

const PATTERNS = {
  plaster: (g, rng) => { speckle(g, rng, 2600, 0.82, 1, 3); for (let i = 0; i < 14; i += 1) { g.fillStyle = gray(0.9 + rng() * 0.1); g.globalAlpha = 0.25; wrapRect(g, rng() * SIZE, rng() * SIZE, 40 + rng() * 60, 30 + rng() * 50); } g.globalAlpha = 1; },
  timber: (g, rng) => { for (let x = 0; x < SIZE; x += 32) { g.fillStyle = gray(0.86 + rng() * 0.14); g.fillRect(x, 0, 30, SIZE); g.fillStyle = gray(0.55); g.fillRect(x + 30, 0, 2, SIZE); } for (let i = 0; i < 260; i += 1) { g.fillStyle = gray(0.7 + rng() * 0.2); g.globalAlpha = 0.35; g.fillRect(rng() * SIZE, rng() * SIZE, 1, 8 + rng() * 40); } g.globalAlpha = 1; },
  wood: (g, rng) => { for (let y = 0; y < SIZE; y += 32) { g.fillStyle = gray(0.84 + rng() * 0.16); g.fillRect(0, y, SIZE, 30); g.fillStyle = gray(0.5); g.fillRect(0, y + 30, SIZE, 2); } for (let i = 0; i < 260; i += 1) { g.fillStyle = gray(0.7 + rng() * 0.2); g.globalAlpha = 0.35; g.fillRect(rng() * SIZE, rng() * SIZE, 8 + rng() * 40, 1); } g.globalAlpha = 1; },
  stone: (g, rng) => { const rows = 6; const h = SIZE / rows; for (let r = 0; r < rows; r += 1) { let x = (r % 2) * 24; while (x < SIZE) { const w = 40 + rng() * 40; g.fillStyle = gray(0.7 + rng() * 0.3); wrapRect(g, x + 2, r * h + 2, w - 4, h - 4); x += w; } } speckle(g, rng, 1500, 0.6, 1, 2); g.globalAlpha = 0.6; g.fillStyle = gray(0.35); for (let r = 0; r < rows; r += 1) g.fillRect(0, r * h, SIZE, 2); g.globalAlpha = 1; },
  roofSlate: (g, rng) => { const rows = 8; const h = SIZE / rows; for (let r = 0; r < rows; r += 1) { let x = (r % 2) * 16; while (x < SIZE) { g.fillStyle = gray(0.78 + rng() * 0.22); wrapRect(g, x + 1, r * h + 1, 30, h - 1); x += 32; } g.fillStyle = gray(0.35); g.fillRect(0, r * h + h - 3, SIZE, 3); } },
  roofTerracotta: (g, rng) => { for (let x = 0; x < SIZE; x += 24) { const v = 0.82 + rng() * 0.18; g.fillStyle = gray(v); g.fillRect(x, 0, 20, SIZE); g.fillStyle = gray(v * 0.55); g.fillRect(x + 20, 0, 4, SIZE); } for (let y = 0; y < SIZE; y += 64) { g.fillStyle = gray(0.55); g.globalAlpha = 0.5; g.fillRect(0, y, SIZE, 3); } g.globalAlpha = 1; },
  roofShingle: (g, rng) => { const rows = 10; const h = SIZE / rows; for (let r = 0; r < rows; r += 1) { let x = (r % 2) * 10; while (x < SIZE) { g.fillStyle = gray(0.7 + rng() * 0.3); wrapRect(g, x + 1, r * h, 18, h - 1); x += 20; } g.fillStyle = gray(0.3); g.fillRect(0, r * h + h - 2, SIZE, 2); } },
  foliage: (g, rng) => { speckle(g, rng, 900, 0.55, 1, 7); for (let i = 0; i < 80; i += 1) { g.fillStyle = gray(0.45 + rng() * 0.2); g.globalAlpha = 0.5; wrapRect(g, rng() * SIZE, rng() * SIZE, 6 + rng() * 10, 6 + rng() * 10); } g.globalAlpha = 1; },
  bark: (g, rng) => { for (let i = 0; i < 380; i += 1) { g.fillStyle = gray(0.45 + rng() * 0.5); g.fillRect(rng() * SIZE, rng() * SIZE, 1 + rng() * 3, 10 + rng() * 50); } },
  soil: (g, rng) => { speckle(g, rng, 3000, 0.55, 1, 3); for (let x = 0; x < SIZE; x += 28) { g.fillStyle = gray(0.62); g.globalAlpha = 0.5; g.fillRect(x, 0, 6, SIZE); } g.globalAlpha = 1; },
  lane: (g, rng) => { speckle(g, rng, 5200, 0.55, 1, 3); for (let i = 0; i < 40; i += 1) { g.fillStyle = gray(0.4 + rng() * 0.3); g.globalAlpha = 0.5; g.beginPath(); g.arc(rng() * SIZE, rng() * SIZE, 2 + rng() * 3, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1; },
  plain: () => {},
};

export function makeHamletTextures() {
  return Object.fromEntries(Object.entries(PATTERNS).map(([key, draw], i) => [key, canvasTexture(draw, 9100 + i * 17)]));
}
