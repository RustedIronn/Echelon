import {
  clamp,
  sampleTerrain,
  smoothstep,
  terrainHorizon,
  terrainLight,
  valueNoise,
} from "./environmentTerrain.js";
import {
  getCelestialState,
  STAR_FIELD,
} from "./environmentCelestial.js";

export const LANDSCAPE_VIEW = Object.freeze({
  width: 1600,
  height: 900,
  horizon: 426,
});

// Future time states change these materials; the terrain and stream stay fixed.
export const DAYLIGHT_PALETTE = Object.freeze({
  skyTop: [138, 183, 207],
  skyHorizon: [244, 227, 190],
  skyGlow: [255, 245, 207],
  meadowFar: [180, 200, 139],
  meadowNear: [69, 111, 72],
  water: [91, 143, 146],
  lightDirection: [.43, .84, -.32],
  ambient: .88,
  contrast: .98,
  haze: .18,
});

const SCENE_WIDTH = 960;
const SCENE_HEIGHT = 540;
let cachedScene = null;

function mix(first, second, amount) {
  return first.map((channel, index) => channel + ((second[index] - channel) * amount));
}

function toRgb(color, alpha = 1) {
  return `rgb(${color.map((channel) => Math.round(channel)).join(" ")} / ${alpha})`;
}

function skyColor(u, y, palette, celestial) {
  const vertical = clamp(y / .53);
  const base = mix(palette.skyTop, palette.skyHorizon, vertical);
  const lightSource = celestial.visibility.sun > .02 ? celestial.sun : celestial.moon;
  const lightDistance = Math.hypot((u - lightSource.x) / .9, (y - lightSource.y) / .72);
  const glow = clamp(1 - lightDistance, 0, 1) ** 2;
  const haze = smoothstep(.22, .56, y) * palette.haze;
  const glowStrength = .04 + (palette.ambient * .19) + (celestial.visibility.sun * .15);
  return mix(mix(base, palette.skyGlow, glow * glowStrength), palette.skyHorizon, haze);
}

function paintSurface(context, palette, celestial) {
  const image = context.createImageData(SCENE_WIDTH, SCENE_HEIGHT);
  const pixels = image.data;
  const farLand = palette.meadowFar;

  for (let y = 0; y < SCENE_HEIGHT; y += 1) {
    const screenY = y / (SCENE_HEIGHT - 1);
    for (let x = 0; x < SCENE_WIDTH; x += 1) {
      const u = x / (SCENE_WIDTH - 1);
      const pixel = ((y * SCENE_WIDTH) + x) * 4;
      const horizon = terrainHorizon(u);

      const sky = skyColor(u, screenY, palette, celestial);
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
      const light = terrainLight(u, v, palette);
      const depthColor = mix(farLand, palette.meadowNear, v ** 1.16);
      const grain = (valueNoise((u * 46) + 20, (v * 46) + 30, 706) - .5) * (2 + (v * 7) * palette.contrast);
      const relief = clamp(.5 + (terrain.height * 2.65), .22, .78);
      let color = depthColor.map((channel) => (channel * light) + grain + ((relief - .5) * 38));

      if (terrain.water > 0) {
        const reflectedSky = mix(palette.skyHorizon, palette.skyTop, .33 + ((1 - v) * .38));
        const waterBase = mix(reflectedSky, palette.water, .57 + (v * .20));
        const shimmer = (valueNoise((u * 92) + 8, (v * 124) + 6, 887) - .5) * 8;
        color = mix(color, waterBase.map((channel) => channel + shimmer), terrain.water * .76);
      }

      const atmosphericFade = (1 - smoothstep(.03, .31, v)) * (palette.haze * 1.2);
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

function withSkyClip(context, draw) {
  context.save();
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(SCENE_WIDTH, 0);
  for (let x = SCENE_WIDTH; x >= 0; x -= 4) {
    context.lineTo(x, terrainHorizon(x / SCENE_WIDTH) * SCENE_HEIGHT);
  }
  context.closePath();
  context.clip();
  draw();
  context.restore();
}

function drawStars(context, celestial) {
  const alpha = celestial.visibility.stars;
  const earlyAlpha = celestial.visibility.earlyStars;
  if (alpha < .008 && earlyAlpha < .008) return;

  context.save();
  const earlyMode = alpha <= .008;
  const visibleStars = earlyMode ? STAR_FIELD.slice(0, 4) : STAR_FIELD;
  const opacity = earlyMode ? earlyAlpha * .72 : alpha;
  for (const star of visibleStars) {
    const x = star.x * SCENE_WIDTH;
    const y = star.y * SCENE_HEIGHT;
    const radius = star.radius * (earlyMode ? 2.5 : 1);
    const glow = context.createRadialGradient(x, y, 0, x, y, radius * 3.2);
    glow.addColorStop(0, `rgb(239 244 255 / ${opacity * star.brightness * .86})`);
    glow.addColorStop(.24, `rgb(202 220 251 / ${opacity * star.brightness * .52})`);
    glow.addColorStop(1, "rgb(202 220 251 / 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, radius * 3.2, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawSun(context, celestial) {
  const alpha = celestial.visibility.sun;
  if (alpha < .01) return;
  const x = celestial.sun.x * SCENE_WIDTH;
  const y = celestial.sun.y * SCENE_HEIGHT;
  const afternoonStrength = smoothstep(12 * 60, 14 * 60, celestial.minuteOfDay)
    * (1 - smoothstep(16 * 60, 17 * 60, celestial.minuteOfDay));
  const radius = 10 + (alpha * 4) + (afternoonStrength * 9);
  const halo = context.createRadialGradient(x, y, radius * .15, x, y, radius * 9);
  halo.addColorStop(0, `rgb(255 248 208 / ${alpha * .82})`);
  halo.addColorStop(.16, `rgb(255 238 169 / ${alpha * .42})`);
  halo.addColorStop(1, "rgb(255 227 155 / 0)");
  context.fillStyle = halo;
  context.beginPath();
  context.arc(x, y, radius * 9, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = `rgb(255 248 211 / ${alpha * .94})`;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function drawMoon(context, celestial, palette) {
  const visibility = celestial.visibility.moon * celestial.lunarPhase.illumination;
  if (visibility < .012) return;
  const x = celestial.moon.x * SCENE_WIDTH;
  const y = celestial.moon.y * SCENE_HEIGHT;
  const radius = 10 + (celestial.lunarPhase.illumination * 3);
  const phase = celestial.lunarPhase.fraction;
  const halo = context.createRadialGradient(x, y, radius * .2, x, y, radius * 7);
  halo.addColorStop(0, `rgb(226 236 255 / ${visibility * .36})`);
  halo.addColorStop(1, "rgb(183 208 255 / 0)");
  context.fillStyle = halo;
  context.beginPath();
  context.arc(x, y, radius * 7, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = `rgb(238 241 224 / ${visibility})`;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  // A shifted sky-coloured disk produces a soft, recognisable crescent,
  // quarter, gibbous, or full phase without assuming geographic accuracy.
  const shadowX = phase <= .5
    ? x - (radius * 4 * phase)
    : x + (radius * 4 * (1 - phase));
  context.fillStyle = toRgb(mix(palette.skyTop, palette.skyHorizon, .28), .92);
  context.beginPath();
  context.arc(shadowX, y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

const CLOUD_FORMATIONS = Object.freeze([
  { x: .16, y: .16, width: 138, height: 20, density: 6, weight: .58, seed: 12 },
  { x: .50, y: .11, width: 235, height: 26, density: 9, weight: .48, seed: 29 },
  { x: .72, y: .25, width: 195, height: 34, density: 7, weight: .74, seed: 57 },
  { x: .34, y: .34, width: 120, height: 18, density: 4, weight: .62, seed: 81 },
  { x: .88, y: .10, width: 105, height: 20, density: 4, weight: .34, seed: 94 },
]);

function paintCloudDab(context, x, y, radiusX, radiusY, color, alpha) {
  context.save();
  context.translate(x, y);
  context.scale(1, radiusY / radiusX);
  const gradient = context.createRadialGradient(0, 0, radiusX * .08, 0, 0, radiusX);
  gradient.addColorStop(0, toRgb(color, alpha));
  gradient.addColorStop(.48, toRgb(color, alpha * .64));
  gradient.addColorStop(1, toRgb(color, 0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radiusX, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawClouds(context, palette) {
  if (palette.cloudOpacity < .01) return;
  context.save();
  context.globalCompositeOperation = "source-over";

  for (const formation of CLOUD_FORMATIONS) {
    const random = createRandom(formation.seed);
    const centerX = formation.x * SCENE_WIDTH;
    const centerY = formation.y * SCENE_HEIGHT;
    const baseAlpha = palette.cloudOpacity * formation.weight * 1.45;

    // The lower shadow and many uneven feathered dabs make a formation read
    // as a shared atmospheric mass rather than a row of cloud icons.
    for (let index = 0; index < formation.density; index += 1) {
      const progress = formation.density === 1 ? .5 : index / (formation.density - 1);
      const x = centerX + ((progress - .5) * formation.width) + ((random() - .5) * 22);
      const y = centerY + ((random() - .18) * formation.height * .48);
      const radiusX = (formation.width / formation.density) * (2.15 + (random() * 1.1));
      const radiusY = formation.height * (.62 + (random() * .38));
      paintCloudDab(context, x + 5, y + (radiusY * .48), radiusX, radiusY, palette.cloudShadow, baseAlpha * (.38 + (random() * .18)));
      paintCloudDab(context, x, y, radiusX, radiusY, palette.cloudLight, baseAlpha * (.52 + (random() * .25)));
    }
  }
  context.restore();
}

function drawCelestialSky(context, palette, celestial) {
  withSkyClip(context, () => {
    drawStars(context, celestial);
    drawSun(context, celestial);
    drawMoon(context, celestial, palette);
    drawClouds(context, palette);
  });
}

function createRandom(seed = 73129) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let output = value;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
}

function drawGrass(context, palette) {
  const grassShade = mix(palette.meadowNear, [30, 73, 52], .42);
  const grassWarmth = mix(palette.meadowFar, [196, 176, 102], .38);
  const random = createRandom(48219);
  context.save();
  context.lineCap = "round";

  for (let cluster = 0; cluster < 190; cluster += 1) {
    const v = .14 + (.84 * Math.sqrt(random()));
    const u = random();

    const terrain = sampleTerrain(u, v);
    if (terrain.water > .001) continue;

    const horizon = terrainHorizon(u);
    const centerX = u * SCENE_WIDTH;
    const centerY = (horizon + (v * (1 - horizon))) * SCENE_HEIGHT;
    const count = 2 + Math.floor(random() * (2 + (v * 4)));
    const spread = 2 + (v * 12);

    for (let blade = 0; blade < count; blade += 1) {
      const startX = centerX + ((random() - .5) * spread);
      const startY = centerY + ((random() - .5) * (1 + (v * 3)));
      const bladeU = clamp(startX / SCENE_WIDTH);
      if (sampleTerrain(bladeU, v).water > .001) continue;
      const height = .8 + (v * v * (4 + (random() * 10)));
      const wind = (.8 + (v * 2.1)) + ((random() - .5) * 1.6);
      const shade = .23 + (v * .34);
      context.strokeStyle = random() > .72
        ? toRgb(grassWarmth, shade * .55)
        : toRgb(grassShade, shade);
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
  haze.addColorStop(.48, toRgb(palette.skyHorizon, palette.haze * .7));
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
  const celestial = getCelestialState(
    palette.timestamp ? new Date(palette.timestamp) : new Date(),
  );
  paintSurface(context, palette, celestial);
  drawAtmosphere(context, palette);
  drawCelestialSky(context, palette, celestial);
  drawGrass(context, palette);
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
