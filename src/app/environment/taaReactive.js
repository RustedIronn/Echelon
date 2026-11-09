// Small moving things (butterflies, birds) have no motion vectors, so TAA's history would blend them away. Objects on REACTIVE.layer are
// drawn into a half-resolution mask each frame, and the TAA pass trusts the current frame wherever that mask is set (linearResolve.js).
// REACTIVE.active is raised by whoever owns such objects while any are visible, so the mask pass costs nothing otherwise.
export const REACTIVE = { layer: 5, active: false };
