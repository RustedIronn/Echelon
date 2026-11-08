import * as THREE from 'three';

// Soft wet band along the authored water footprint, used to darken and slightly saturate the terrain albedo where the channel
// meets the bank. It is derived only from the existing water surface (no new geometry, scatter or placements) and is
// rasterised once at load into a small single-channel map. Parameters were fitted against the saved Blender frame
// (see design-reference/environment/webgl-prototype/WATER_REFINEMENT_REVIEW.md).
// fadeNear/fadeFar: the exposed bank only reads up to a few tens of metres; farther out the channel is covered by grass in the reference, so the band fades away.
export const BANK_WETNESS = { resolution: 1024, blurMetres: 1.5, padMetres: 6, darkness: 0.88, saturation: 0.2, lo: 0.08, hi: 0.55, fadeNear: 70, fadeFar: 120 };

// positions: flat xyz array in world (Three) coordinates; the footprint lives in the XZ plane.
export function footprintBounds(positions, padMetres = BANK_WETNESS.padMetres) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i]);
    minZ = Math.min(minZ, positions[i + 2]); maxZ = Math.max(maxZ, positions[i + 2]);
  }
  return { minX: minX - padMetres, maxX: maxX + padMetres, minZ: minZ - padMetres, maxZ: maxZ + padMetres };
}

// Fills every texel whose centre lies inside any water triangle with 255.
export function rasterizeFootprint(positions, indices, bounds, resolution = BANK_WETNESS.resolution) {
  const spanX = bounds.maxX - bounds.minX; const spanZ = bounds.maxZ - bounds.minZ; const scale = resolution / Math.max(spanX, spanZ);
  const width = Math.ceil(spanX * scale); const height = Math.ceil(spanZ * scale); const data = new Uint8Array(width * height);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3; const b = indices[t + 1] * 3; const c = indices[t + 2] * 3;
    const ax = (positions[a] - bounds.minX) * scale; const az = (positions[a + 2] - bounds.minZ) * scale;
    const bx = (positions[b] - bounds.minX) * scale; const bz = (positions[b + 2] - bounds.minZ) * scale;
    const cx = (positions[c] - bounds.minX) * scale; const cz = (positions[c + 2] - bounds.minZ) * scale;
    const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(denominator) < 1e-12) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))); const x1 = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
    const z0 = Math.max(0, Math.floor(Math.min(az, bz, cz))); const z1 = Math.min(height - 1, Math.ceil(Math.max(az, bz, cz)));
    for (let z = z0; z <= z1; z += 1) for (let x = x0; x <= x1; x += 1) {
      const px = x + 0.5 - cx; const pz = z + 0.5 - cz;
      const u = ((bz - cz) * px + (cx - bx) * pz) / denominator; const v = ((cz - az) * px + (ax - cx) * pz) / denominator; const w = 1 - u - v;
      if (u >= 0 && v >= 0 && w >= 0) data[z * width + x] = 255;
    }
  }
  return { data, width, height, metresPerTexel: 1 / scale };
}

// Repeated box blurs approximate a Gaussian of the requested sigma (in texels).
export function blurMask(source, width, height, sigmaTexels, passes = 3) {
  if (sigmaTexels <= 0) return source;
  const radius = Math.max(1, Math.round((-1 + Math.sqrt(1 + (12 * sigmaTexels * sigmaTexels) / passes)) / 2));
  let current = Float32Array.from(source); let scratch = new Float32Array(current.length); const window = 2 * radius + 1;
  for (let pass = 0; pass < passes; pass += 1) {
    for (let y = 0; y < height; y += 1) {
      let sum = 0; const row = y * width;
      for (let x = -radius; x <= radius; x += 1) sum += current[row + Math.min(width - 1, Math.max(0, x))];
      for (let x = 0; x < width; x += 1) {
        scratch[row + x] = sum / window;
        sum += current[row + Math.min(width - 1, x + radius + 1)] - current[row + Math.max(0, x - radius)];
      }
    }
    [current, scratch] = [scratch, current];
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let y = -radius; y <= radius; y += 1) sum += current[Math.min(height - 1, Math.max(0, y)) * width + x];
      for (let y = 0; y < height; y += 1) {
        scratch[y * width + x] = sum / window;
        sum += current[Math.min(height - 1, y + radius + 1) * width + x] - current[Math.max(0, y - radius) * width + x];
      }
    }
    [current, scratch] = [scratch, current];
  }
  const out = new Uint8Array(current.length); for (let i = 0; i < out.length; i += 1) out[i] = Math.round(current[i]);
  return out;
}

export function buildWetnessMask(positions, indices, options = BANK_WETNESS) {
  const bounds = footprintBounds(positions, options.padMetres);
  const raster = rasterizeFootprint(positions, indices, bounds, options.resolution);
  const data = blurMask(raster.data, raster.width, raster.height, options.blurMetres / raster.metresPerTexel);
  return { data, width: raster.width, height: raster.height, bounds, metresPerTexel: raster.metresPerTexel };
}

export function createBankWetness(waterGeometry, options = BANK_WETNESS) {
  const positions = waterGeometry.attributes.position.array; const index = waterGeometry.index;
  const indices = index ? index.array : Uint32Array.from({ length: waterGeometry.attributes.position.count }, (_, i) => i);
  const mask = buildWetnessMask(positions, indices, options);
  const texture = new THREE.DataTexture(mask.data, mask.width, mask.height, THREE.RedFormat, THREE.UnsignedByteType);
  texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; texture.flipY = false; texture.unpackAlignment = 1;
  texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
  return {
    params: new THREE.Vector4(options.darkness, options.saturation, options.lo, options.hi),
    texture, min: new THREE.Vector2(mask.bounds.minX, mask.bounds.minZ),
    // Extent the texture actually covers (texel aligned), which is what the shader must divide by.
    span: new THREE.Vector2(mask.width * mask.metresPerTexel, mask.height * mask.metresPerTexel), metresPerTexel: mask.metresPerTexel,
    ...options,
  };
}
