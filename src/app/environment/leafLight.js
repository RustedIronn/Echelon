// Shared leaf-lighting controls, driven by the time of day (timeOfDay.js) and read by the grass shader (alpineParityMaterials.js).
// backlight: how strongly blades glow with light coming through them. The glow is tinted warm green for sunlight; under the moon (the only
// directional light at night) it made a full-moon meadow glow vivid green, so the night keeps only a trace of it.
export const LEAF_LIGHT = { backlight: { value: 1 } };
