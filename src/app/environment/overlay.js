import * as THREE from 'three';

// Things drawn over the finished, anti-aliased frame (linearResolve.js), before the display transform: tiny moving particles that temporal
// anti-aliasing would otherwise smear and fade, since they have no motion vectors. They are not written into the TAA history's next input, and the
// next frame's neighbourhood clamp drops them from the history, so they never ghost. No depth test: keep to things that float in open air.
export const OVERLAY = { scene: new THREE.Scene() };
