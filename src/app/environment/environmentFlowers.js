import {
  clamp,
  sampleTerrain,
  smoothstep,
  valueNoise,
} from "./environmentTerrain.js";

const FLOWER_SEED = 94871;
const WATER_MARGIN = .012;
const MAX_FLOWERS = 176;

export const FLOWER_FAMILIES = Object.freeze([
  Object.freeze({ petal: [231, 194, 104], center: [143, 99, 47] }),
  Object.freeze({ petal: [206, 145, 166], center: [133, 82, 104] }),
  Object.freeze({ petal: [143, 171, 208], center: [92, 112, 126] }),
]);

function createRandom(seed = FLOWER_SEED) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let output = value;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
}

function hasWaterMargin(u, v) {
  return [u, u - WATER_MARGIN, u + WATER_MARGIN].some((sampleU) => (
    sampleTerrain(clamp(sampleU), v).water > .001
  ));
}

function flowerDensity(u, v) {
  // Two coherent scales give the meadow broad, quiet-to-rich regions with
  // smaller local pockets. A low baseline keeps those regions connected,
  // avoiding a handful of stamped islands.
  const broadGrowth = valueNoise((u * 1.8) + 17, (v * 1.25) + 3, 1781);
  const localGrowth = valueNoise((u * 6.2) + 31, (v * 4.8) + 11, 4481);
  // Perspective already makes the foreground more visually prominent. This
  // is intentionally only a gentle population preference, not a depth gate.
  const foregroundWeight = .72 + (.28 * smoothstep(.24, .94, v));
  const localRichness = .35 + (.65 * smoothstep(.28, .82, localGrowth));
  return clamp((.14 + (broadGrowth * .42) + (localRichness * .23)) * foregroundWeight);
}

function createFlowerAnchors() {
  const random = createRandom();
  const anchors = [];

  // Candidates begin nearly uniform across the whole visible meadow. Richness
  // is shaped afterwards by the coherent density field rather than by pushing
  // anchor positions toward the bottom of the viewport.
  for (let attempt = 0; attempt < 2400 && anchors.length < MAX_FLOWERS; attempt += 1) {
    const u = .025 + (random() * .95);
    const v = .24 + (.70 * random());
    const density = flowerDensity(u, v);
    if (random() > density || hasWaterMargin(u, v)) continue;

    const colourRegion = valueNoise((u * 2.2) + 7, (v * 1.9) + 19, 8123);
    anchors.push(Object.freeze({
      u,
      v,
      // Size lives in the 960x540 scene's pixel space. Perspective is
      // applied by the renderer from v, so distant blooms stay understated.
      size: .82 + (random() * .78),
      lean: (random() - .5) * 2.3,
      petalCount: 5 + Math.floor(random() * 2),
      rotation: random() * Math.PI * 2,
      // Colour shifts are locally related while each flower remains varied.
      family: (Math.floor(colourRegion * FLOWER_FAMILIES.length) + (random() > .82 ? 1 : 0)) % FLOWER_FAMILIES.length,
      tint: .92 + (random() * .20),
      petalShape: Math.floor(random() * 3),
    }));
  }

  return Object.freeze(anchors);
}

export const FLOWER_ANCHORS = createFlowerAnchors();
