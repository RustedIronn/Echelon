// Anti-aliasing. The "crunchy" look was shading and thin-edge aliasing that MSAA cannot reach (it smooths triangle edges only, not the lighting inside
// sub-pixel blades or alpha-cut petals). Measured at 2560x1440 (share of hard pixel steps in the foreground meadow; GPU ms):
//   8x MSAA at native resolution            1.94%  17.2 ms   (previous default)
//   1.25x supersampling + 4x MSAA + A2C     0.65%  17.7 ms   (default now)
//   1.5x + 4x                               0.98%  19.9 ms;   2x + 2x  1.53%  22.8 ms
// Supersampling renders more pixels than the screen has and lets the browser filter them down, which reaches the shading too.
// ?ss=1 restores native resolution (with 8x MSAA); ?ss=1.5 etc. sets the factor; ?aa=noa2c turns alpha-to-coverage off on the flowers.
const params = typeof window === 'undefined' ? new URLSearchParams('') : new URLSearchParams(window.location.search);
const aa = (params.get('aa') || '').split(',');
export const FOLIAGE_A2C = !aa.includes('noa2c');
export const SUPERSAMPLE = (() => { const v = Number(params.get('ss')); return v >= 1 && v <= 2 ? v : 1.25; })();
export const DEFAULT_MSAA = SUPERSAMPLE > 1 ? 4 : 8;
