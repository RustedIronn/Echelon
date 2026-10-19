export const LANDSCAPE_VIEW = Object.freeze({
  width: 1600,
  height: 900,
  horizon: 426,
});

// Future time states change these materials; the terrain and stream stay fixed.
export const DAYLIGHT_PALETTE = Object.freeze({
  skyTop: [138, 183, 207],
  skyHorizon: [244, 227, 190],
  meadowFar: [180, 200, 139],
  meadowNear: [69, 111, 72],
  water: [91, 143, 146],
});

const SCENE_WIDTH = 960;
const SCENE_HEIGHT = 540;
const SCENE_SEED = 73129;
let cachedScene = null;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / (edge1 - edge0));
  return amount * amount * (3 - (2 * amount));
}

function mix(first, second, amount) {
  return first.map((channel, index) => channel + ((second[index] - channel) * amount));
}

function toRgb(color, alpha = 1) {
  return `rgb(${color.map((channel) => Math.round(channel)).join(" ")} / ${alpha})`;
}

function hash(x, y, seed = SCENE_SEED) {
  const value = Math.sin((x * 127.1) + (y * 311.7) + (seed * .013)) * 43758.5453123;
  return value - Math.floor(value);
}

function valueNoise(x, y, seed = SCENE_SEED) {
  const gridX = Math.floor(x);
  const gridY = Math.floor(y);
  const localX = x - gridX;
  const localY = y - gridY;
  const easeX = localX * localX * (3 - (2 * localX));
  const easeY = localY * localY * (3 - (2 * localY));
  const bottom = hash(gridX, gridY, seed) + ((hash(gridX + 1, gridY, seed) - hash(gridX, gridY, seed)) * easeX);
  const top = hash(gridX, gridY + 1, seed) + ((hash(gridX + 1, gridY + 1, seed) - hash(gridX, gridY + 1, seed)) * easeX);
  return bottom + ((top - bottom) * easeY);
}

function terrainHorizon(u) {
  const broad = (valueNoise((u * 2.1) + 9, .4, 914) - .5) * .026;
  const small = (valueNoise((u * 6.4) + 3, 1.4, 417) - .5) * .008;
  return .477 + broad + small;
}

function streamCenter(v) {
  return .518
    + (.078 * v)
    + (.038 * Math.sin((v * 8.1) - .8) * (v ** .72))
    - (.026 * Math.sin((v * 16.2) + .4) * (v ** 1.85));
}

function streamWidth(v) {
  return .0006 + (.041 * (v ** 1.78));
}

// This is the single world surface. The channel is carved out of it before
// normal-based light is evaluated, so the banks are terrain, not outlines.
function sampleTerrain(u, v) {
  const valleyCenter = streamCenter(v) + (.018 * Math.sin((v * 3.7) + .3));
  const broadValley = Math.exp(-(((u - valleyCenter) / .29) ** 2));
  const longRoll = (valueNoise((u * 2.25) + 2, (v * 1.4) + 7, 201) - .5) * .115;
  const fineRoll = (valueNoise((u * 8.2) + 5, (v * 6.4) + 1, 603) - .5) * .026;
  const distantRidges = (1 - smoothstep(.05, .63, v))
    * ((valueNoise((u * 3.1) + 1, (v * 1.15) + 12, 311) - .5) * .085);
  const foregroundSlope = v * .105;
  const naturalHeight = foregroundSlope + longRoll + fineRoll + distantRidges - (broadValley * .046);

  const width = streamWidth(v);
  const lateral = Math.abs(u - streamCenter(v)) / width;
  const channelProfile = 1 - smoothstep(.52, 1.18, lateral);
  const sourceFade = smoothstep(.035, .17, v);
  const channel = channelProfile * sourceFade;
  const channelDepth = channel * (.020 + (.080 * (v ** 1.15)));
  const water = smoothstep(.45, .84, channelProfile) * sourceFade;

  return {
    height: naturalHeight - channelDepth,
    water,
    channel,
  };
}

function terrainLight(u, v) {
  const step = .0014;
  const left = sampleTerrain(clamp(u - step), v).height;
  const right = sampleTerrain(clamp(u + step), v).height;
  const distant = sampleTerrain(u, clamp(v - step)).height;
  const near = sampleTerrain(u, clamp(v + step)).height;
  const normalX = (left - right) * 28;
  const normalZ = (distant - near) * 28;
  const length = Math.hypot(normalX, 1, normalZ);
  const light = ((normalX * .43) + .84 + (normalZ * -.32)) / length;
  return clamp(.65 + (light * .34), .52, 1.04);
}

function skyColor(u, y, palette) {
  const vertical = clamp(y / .53);
  const base = mix(palette.skyTop, palette.skyHorizon, vertical);
  const lightDistance = Math.hypot((u - .78) / .9, (y - .20) / .72);
  const glow = clamp(1 - lightDistance, 0, 1) ** 2;
  const haze = smoothstep(.22, .56, y) * .22;
  return mix(mix(base, [255, 245, 207], glow * .36), [245, 234, 211], haze);
}

function paintSurface(context, palette) {
  const image = context.createImageData(SCENE_WIDTH, SCENE_HEIGHT);
  const pixels = image.data;
  const farLand = [171, 192, 144];

  for (let y = 0; y < SCENE_HEIGHT; y += 1) {
    const screenY = y / (SCENE_HEIGHT - 1);
    for (let x = 0; x < SCENE_WIDTH; x += 1) {
      const u = x / (SCENE_WIDTH - 1);
      const pixel = ((y * SCENE_WIDTH) + x) * 4;
      const horizon = terrainHorizon(u);

      const sky = skyColor(u, screenY, palette);
      const landCoverage = smoothstep(-.014, .020, screenY - horizon);
      if (landCoverage === 0) {
        pixels[pixel] = sky[0];
        pixels[pixel + 1] = sky[1];
        pixels[pixel + 2] = sky[2];
        pixels[pixel + 3] = 255;
        continue;
      }
      const v = clamp((screenY - horizon) / (1 - horizon));
      const terrain = sampleTerrain(u, v);
      const light = terrainLight(u, v);
      const depthColor = mix(farLand, palette.meadowNear, v ** 1.16);
      const grain = (valueNoise((u * 46) + 20, (v * 46) + 30, 706) - .5) * (2 + (v * 7));
      const relief = clamp(.5 + (terrain.height * 2.65), .22, .78);
      let color = depthColor.map((channel) => (channel * light) + grain + ((relief - .5) * 38));

      if (terrain.water > 0) {
        const reflectedSky = mix(palette.skyHorizon, palette.skyTop, .33 + ((1 - v) * .38));
        const waterBase = mix(reflectedSky, palette.water, .57 + (v * .20));
        const shimmer = (valueNoise((u * 92) + 8, (v * 124) + 6, 887) - .5) * 8;
        color = mix(color, waterBase.map((channel) => channel + shimmer), terrain.water * .76);
      }

      const atmosphericFade = (1 - smoothstep(.03, .31, v)) * .30;
      color = mix(color, palette.skyHorizon, atmosphericFade);
      color = mix(sky, color, landCoverage);
      pixels[pixel] = clamp(Math.round(color[0]), 0, 255);
      pixels[pixel + 1] = clamp(Math.round(color[1]), 0, 255);
      pixels[pixel + 2] = clamp(Math.round(color[2]), 0, 255);
      pixels[pixel + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
}

function createRandom(seed = SCENE_SEED) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let output = value;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
}

function drawGrass(context) {
  const random = createRandom(48219);
  context.save();
  context.lineCap = "round";

  for (let cluster = 0; cluster < 165; cluster += 1) {
    const v = .14 + (.84 * Math.sqrt(random()));
    let u = random();
    if (random() < .31) {
      const side = random() < .5 ? -1 : 1;
      u = streamCenter(v) + (side * (streamWidth(v) + .014 + (random() * .055)));
    }

    const terrain = sampleTerrain(u, v);
    if (terrain.water > .04) continue;

    const horizon = terrainHorizon(u);
    const centerX = u * SCENE_WIDTH;
    const centerY = (horizon + (v * (1 - horizon))) * SCENE_HEIGHT;
    const count = 2 + Math.floor(random() * (2 + (v * 4)));
    const spread = 2 + (v * 12);

    for (let blade = 0; blade < count; blade += 1) {
      const startX = centerX + ((random() - .5) * spread);
      const startY = centerY + ((random() - .5) * (1 + (v * 3)));
      const height = .8 + (v * v * (4 + (random() * 10)));
      const wind = (.8 + (v * 2.1)) + ((random() - .5) * 1.6);
      const shade = .23 + (v * .34);
      context.strokeStyle = random() > .72
        ? `rgb(190 183 112 / ${shade * .55})`
        : `rgb(48 98 68 / ${shade})`;
      context.lineWidth = .28 + (v * .45);
      context.beginPath();
      context.moveTo(startX, startY);
      context.quadraticCurveTo(startX + (wind * .25), startY - (height * .6), startX + wind, startY - height);
      context.stroke();
    }
  }
  context.restore();
}

function drawAtmosphere(context, palette) {
  const horizon = LANDSCAPE_VIEW.horizon / LANDSCAPE_VIEW.height;
  const haze = context.createLinearGradient(0, SCENE_HEIGHT * (horizon - .03), 0, SCENE_HEIGHT * (horizon + .17));
  haze.addColorStop(0, "rgb(255 244 215 / 0)");
  haze.addColorStop(.48, toRgb(palette.skyHorizon, .12));
  haze.addColorStop(1, "rgb(255 244 215 / 0)");
  context.fillStyle = haze;
  context.fillRect(0, SCENE_HEIGHT * (horizon - .03), SCENE_WIDTH, SCENE_HEIGHT * .21);
}

function getOffscreenCanvas(sourceCanvas) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(SCENE_WIDTH, SCENE_HEIGHT);
  }
  const document = sourceCanvas?.ownerDocument;
  if (!document) return null;
  const canvas = document.createElement("canvas");
  canvas.width = SCENE_WIDTH;
  canvas.height = SCENE_HEIGHT;
  return canvas;
}

function buildScene(sourceCanvas, palette) {
  const surface = getOffscreenCanvas(sourceCanvas);
  const context = surface?.getContext("2d", { alpha: false });
  if (!surface || !context) return null;
  paintSurface(context, palette);
  drawAtmosphere(context, palette);
  drawGrass(context);
  return surface;
}

export function renderLandscape(context, palette = DAYLIGHT_PALETTE) {
  const { width, height } = LANDSCAPE_VIEW;
  try {
    if (!cachedScene || cachedScene.palette !== palette) {
      cachedScene = { palette, surface: buildScene(context.canvas, palette) };
    }
    context.clearRect(0, 0, width, height);
    if (cachedScene.surface) {
      context.drawImage(cachedScene.surface, 0, 0, width, height);
      return;
    }
  } catch {
    // Keep the app shell usable if offscreen rendering is unavailable.
  }

  const fallback = context.createLinearGradient(0, 0, 0, height);
  fallback.addColorStop(0, "#9cc4d7");
  fallback.addColorStop(.5, "#ede2bd");
  fallback.addColorStop(1, "#789d69");
  context.fillStyle = fallback;
  context.fillRect(0, 0, width, height);
}
