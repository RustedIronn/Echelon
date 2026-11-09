// Shared leaf-lighting controls, driven by the time of day (timeOfDay.js) and read by the grass shader (alpineParityMaterials.js).
// backlight: how strongly blades glow with light coming through them. The glow is tinted warm green for sunlight; under the moon (the only
// directional light at night) it made a full-moon meadow glow vivid green, so the night keeps only a trace of it.
export const LEAF_LIGHT = { backlight: { value: 1 } };
// Flower clock (flowerBehaviour.js): close 0 open .. 1 shut for the night; lean 0..1, how far heads turn toward the sun.
export const FLOWER_LIGHT = { close: { value: 0 }, lean: { value: 0 } };
