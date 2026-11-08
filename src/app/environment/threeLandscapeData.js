import * as THREE from "three";

// One shared coordinate system for the entire world. The meadow, channel,
// foothills and mountain are sampled from this same height field.
export const WORLD = Object.freeze({ width: 150, near: 52, far: -158, meadowEnd: -58 });
const STREAM_ORIGIN = -110;

function seededRandom(seed = 45031) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothNoise(x, z, seed = 1) {
  return (Math.sin((x * .105) + (z * .061) + seed) * .5)
    + (Math.cos((x * .223) - (z * .109) + (seed * 1.7)) * .3)
    + (Math.sin((x * .49) + (z * .37) + (seed * 4.1)) * .2);
}

const clamp01 = (value) => THREE.MathUtils.clamp(value, 0, 1);
const smoothstep = (edge0, edge1, value) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - (2 * t));
};

export function streamCenterAt(z) {
  const distance = clamp01((z - STREAM_ORIGIN) / (WORLD.near - STREAM_ORIGIN));
  return -.35
    + (Math.sin((distance * 6.35) + .22) * (.08 + (distance * 3.45)))
    + (Math.sin((distance * 13.4) - .8) * distance * .68);
}

export function streamWidthAt(z) {
  const distance = clamp01((z - STREAM_ORIGIN) / (WORLD.near - STREAM_ORIGIN));
  const width = .025 + (2.05 * (distance ** 1.58));
  return width * (1 + (Math.sin((distance * 8.2) + .4) * .1));
}

function meadowBaseHeight(x, z) {
  const foregroundLift = Math.max(0, z + 4) * .017;
  const broadValley = -Math.exp(-(((x + .5) / 25) ** 2)) * .36;
  const rolling = smoothNoise(x, z, 2) * .17;
  const farRise = smoothstep(-75, -48, z) * (.46 + (Math.sin(x * .14) * .12));
  return foregroundLift + broadValley + rolling + farRise;
}

function foothillHeight(x, z) {
  const fade = 1 - smoothstep(-76, -52, z);
  const ridgeA = Math.exp(-(((z + 73) / 17) ** 2)) * (1.25 + (Math.sin((x * .075) + .7) * .34) + (Math.cos(x * .16) * .18));
  const ridgeB = Math.exp(-(((z + 88) / 20) ** 2)) * (2.45 + (Math.sin((x * .052) - .8) * .55) + (Math.cos(x * .11) * .34));
  return (ridgeA + ridgeB) * fade;
}

function mountainHeight(x, z) {
  const rangeFade = 1 - smoothstep(-97, -80, z);
  const mainPeak = Math.exp(-(((x - 2) / 15) ** 2) - (((z + 111) / 16) ** 2)) * 9.4;
  const summitSpire = Math.exp(-(((x - 1) / 5.6) ** 2) - (((z + 110) / 7.2) ** 2)) * 2.7;
  const westPeak = Math.exp(-(((x + 18) / 11) ** 2) - (((z + 107) / 16) ** 2)) * 6.3;
  const eastPeak = Math.exp(-(((x - 22) / 12) ** 2) - (((z + 114) / 18) ** 2)) * 5.8;
  const westShoulder = Math.exp(-(((x + 31) / 28) ** 2) - (((z + 108) / 28) ** 2)) * 4.8;
  const eastShoulder = Math.exp(-(((x - 36) / 30) ** 2) - (((z + 115) / 31) ** 2)) * 4.5;
  return Math.max(0, (mainPeak + summitSpire + westPeak + eastPeak + westShoulder + eastShoulder + (smoothNoise(x * .7, z * .7, 12) * .82)) * rangeFade);
}

export function terrainHeightAt(x, z, { includeChannel = true } = {}) {
  const base = meadowBaseHeight(x, z) + foothillHeight(x, z) + mountainHeight(x, z);
  if (!includeChannel || z < STREAM_ORIGIN) return base;
  const width = streamWidthAt(z);
  const fromCenter = Math.abs(x - streamCenterAt(z));
  const channel = Math.exp(-((fromCenter / (width * 1.12)) ** 4));
  const channelDepth = (.08 + (width * .31)) * channel;
  const shoulder = Math.exp(-(((fromCenter - width) / (width * .66 + .15)) ** 2)) * (.075 + (width * .04));
  return base - channelDepth + shoulder;
}

export function waterHeightAt(z) {
  const center = streamCenterAt(z);
  const bank = terrainHeightAt(center + (streamWidthAt(z) * .95), z, { includeChannel: false });
  return bank - (.11 + (streamWidthAt(z) * .12));
}

export function isWaterAt(x, z, margin = 0) {
  return z >= STREAM_ORIGIN && z <= WORLD.near
    && Math.abs(x - streamCenterAt(z)) < (streamWidthAt(z) * .73) + margin;
}

// Keep the static terrain under the broadly supported 16-bit index limit while
// retaining enough resolution for the carved banks and distant relief.
function createSurfaceGeometry({ near, far, segmentsX, segmentsZ }) {
  const positions = [];
  const uvs = [];
  const streamBanks = [];
  const indices = [];
  for (let row = 0; row <= segmentsZ; row += 1) {
    const v = row / segmentsZ;
    const z = THREE.MathUtils.lerp(far, near, v);
    for (let column = 0; column <= segmentsX; column += 1) {
      const u = column / segmentsX;
      const x = THREE.MathUtils.lerp(-(WORLD.width * .5), WORLD.width * .5, u);
      positions.push(x, terrainHeightAt(x, z), z);
      uvs.push(u, v);
      const width = streamWidthAt(z);
      const fromCenter = Math.abs(x - streamCenterAt(z));
      const bank = z < STREAM_ORIGIN ? 0 : Math.exp(-(((fromCenter - width) / (width * .32 + .1)) ** 2));
      streamBanks.push(bank);
      if (row < segmentsZ && column < segmentsX) {
        const current = (row * (segmentsX + 1)) + column;
        indices.push(current, current + segmentsX + 1, current + 1, current + 1, current + segmentsX + 1, current + segmentsX + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("uv2", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("streamBank", new THREE.Float32BufferAttribute(streamBanks, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createTerrainGeometry() {
  return createSurfaceGeometry({ near: WORLD.near, far: WORLD.meadowEnd - .5, segmentsX: 240, segmentsZ: 200 });
}

export function createDistantTerrainGeometry() {
  return createSurfaceGeometry({ near: WORLD.meadowEnd + .5, far: WORLD.far, segmentsX: 150, segmentsZ: 150 });
}

export function createStreamGeometry(samples = 330, across = 10, { widthMultiplier = .76, verticalOffset = 0 } = {}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let row = 0; row <= samples; row += 1) {
    const progress = row / samples;
    const z = STREAM_ORIGIN + (progress * (WORLD.near - STREAM_ORIGIN));
    const center = streamCenterAt(z);
    const width = streamWidthAt(z) * widthMultiplier;
    const bend = (streamCenterAt(z + .05) - streamCenterAt(z - .05)) / .1;
    const inverseLength = 1 / Math.hypot(1, bend);
    const normalX = inverseLength;
    const normalZ = -bend * inverseLength;
    for (let column = 0; column <= across; column += 1) {
      const acrossProgress = column / across;
      const signed = (acrossProgress * 2) - 1;
      const x = center + (normalX * width * signed);
      const localZ = z + (normalZ * width * signed);
      positions.push(x, waterHeightAt(z) + verticalOffset + ((1 - (signed * signed)) * .009), localZ);
      uvs.push(acrossProgress, progress);
      if (row < samples && column < across) {
        const current = (row * (across + 1)) + column;
        indices.push(current, current + across + 1, current + 1, current + 1, current + across + 1, current + across + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function growthProbability(x, z) {
  const broad = (smoothNoise(x * .25, z * .25, 7) + 1) * .5;
  const fine = (smoothNoise(x * .85, z * .85, 19) + 1) * .5;
  const depth = clamp01((z - WORLD.meadowEnd) / (WORLD.near - WORLD.meadowEnd));
  return .22 + (broad * .28) + (fine * .11) + (depth * .12);
}

export function createWildflowerData(count = 980) {
  const random = seededRandom(82291);
  const flowers = [];
  const pockets = Array.from({ length: 28 }, () => ({ x: -31 + (random() * 62), z: -52 + (random() * 98), radius: 2.4 + (random() * 5.8), richness: .28 + (random() * .42) }));
  for (let attempt = 0; attempt < count * 22 && flowers.length < count; attempt += 1) {
    const z = -55 + (random() * 104);
    const x = -37 + (random() * 74);
    if (isWaterAt(x, z, .34)) continue;
    const pocket = pockets.reduce((value, current) => Math.max(value, current.richness * Math.exp(-((((x - current.x) ** 2) + ((z - current.z) ** 2)) / (current.radius ** 2)))), 0);
    if (random() > Math.min(.91, growthProbability(x, z) + pocket)) continue;
    const depth = clamp01((z - WORLD.meadowEnd) / (WORLD.near - WORLD.meadowEnd));
    flowers.push({ x, y: terrainHeightAt(x, z), z, scale: (.24 + (random() * .225)) * (.55 + (depth * .72)), rotation: random() * Math.PI * 2, species: Math.floor(random() * 16) });
  }
  return flowers;
}

export function createFoliageData(count = 560) {
  const random = seededRandom(90117);
  const foliage = [];
  for (let attempt = 0; attempt < count * 12 && foliage.length < count; attempt += 1) {
    const z = -54 + (random() * 105);
    const x = -37 + (random() * 74);
    if (isWaterAt(x, z, .22) || random() > growthProbability(x, z)) continue;
    const depth = clamp01((z - WORLD.meadowEnd) / (WORLD.near - WORLD.meadowEnd));
    foliage.push({ x, y: terrainHeightAt(x, z) + .008, z, scale: (.13 + (random() * .18)) * (.65 + (depth * .64)), rotation: random() * Math.PI });
  }
  return foliage;
}
