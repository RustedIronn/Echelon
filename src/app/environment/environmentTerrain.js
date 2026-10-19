const TERRAIN_SEED = 73129;

export function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / (edge1 - edge0));
  return amount * amount * (3 - (2 * amount));
}

function hash(x, y, seed = TERRAIN_SEED) {
  const value = Math.sin((x * 127.1) + (y * 311.7) + (seed * .013)) * 43758.5453123;
  return value - Math.floor(value);
}

export function valueNoise(x, y, seed = TERRAIN_SEED) {
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

function farRidgeProfile(u) {
  const rise = (center, span, height) => height * Math.exp(-(((u - center) / span) ** 2));
  return rise(.17, .12, .009) + rise(.51, .16, .016) + rise(.82, .11, .010);
}

export function terrainHorizon(u) {
  const broad = (valueNoise((u * 2.1) + 9, .4, 914) - .5) * .020;
  const small = (valueNoise((u * 6.4) + 3, 1.4, 417) - .5) * .005;
  // Three low, softened rises establish distant terrain without competing with sky.
  return .477 + broad + small - farRidgeProfile(u);
}

export function streamCenter(v) {
  return .518
    + (.078 * v)
    + (.038 * Math.sin((v * 8.1) - .8) * (v ** .72))
    - (.026 * Math.sin((v * 16.2) + .4) * (v ** 1.85));
}

export function streamWidth(v) {
  return .0006 + (.041 * (v ** 1.78));
}

// The terrain and water share this one height field. A stream channel is
// subtracted before the normal is measured, making its banks genuine slopes.
export function sampleTerrain(u, v) {
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

export function terrainLight(u, v, lighting = {}) {
  const step = .0014;
  const left = sampleTerrain(clamp(u - step), v).height;
  const right = sampleTerrain(clamp(u + step), v).height;
  const distant = sampleTerrain(u, clamp(v - step)).height;
  const near = sampleTerrain(u, clamp(v + step)).height;
  const normalX = (left - right) * 28;
  const normalZ = (distant - near) * 28;
  const length = Math.hypot(normalX, 1, normalZ);
  const [lightX = .43, lightY = .84, lightZ = -.32] = lighting.lightDirection ?? [];
  const light = ((normalX * lightX) + lightY + (normalZ * lightZ)) / length;
  const ambient = lighting.ambient ?? .88;
  const contrast = lighting.contrast ?? .98;
  return clamp((ambient * .57) + (light * .43 * contrast), .25, 1.06);
}
