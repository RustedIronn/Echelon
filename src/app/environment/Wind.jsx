import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { WIND, windWanted, animationFps, prefersReducedMotion } from './wind.js';

// The animation governor. The scene renders on demand; while wind is on, this asks for frames at a cadence set by how the world is being viewed:
// 60 fps while the landscape is looked at, 30 fps behind UI panels, none while it is obscured or the tab is hidden (it still redraws on any change).
// The host app sets the activity with window.__echelonWorld.setActivity('scenic' | 'work' | 'obscured'); the preview accepts ?activity=work.
// Wind time follows the wall clock, so lowering or pausing the cadence never makes the sway jump or speed up afterwards.
export default function Wind() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = { activity: params.get('activity') || 'scenic', wind: windWanted() };
    const start = performance.now(); let raf = 0, last = 0;
    const apply = () => { WIND.strength.value = state.wind ? 1 : 0; invalidate(); };
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const fps = animationFps({ activity: state.activity, hidden: document.hidden, wind: state.wind }); if (!fps) return;
      if (now - last < 1000 / fps - 2) return; // 2 ms tolerance keeps 60 fps on a 60 Hz display
      last = now; WIND.time.value = (now - start) / 1000; invalidate();
    };
    raf = requestAnimationFrame(tick);
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)'); const onMotion = () => { state.wind = windWanted(); apply(); };
    motion?.addEventListener?.('change', onMotion);
    const onVisible = () => { if (!document.hidden) invalidate(); }; document.addEventListener('visibilitychange', onVisible);
    window.__echelonWorld = { ...(window.__echelonWorld || {}),
      setActivity: (activity) => { state.activity = activity in { scenic: 1, work: 1, obscured: 1 } ? activity : 'scenic'; invalidate(); },
      setWind: (on) => { state.wind = Boolean(on) && !prefersReducedMotion(); apply(); },
      get animation() { return { activity: state.activity, wind: state.wind, fps: animationFps({ activity: state.activity, hidden: document.hidden, wind: state.wind }) }; } };
    apply();
    return () => { cancelAnimationFrame(raf); motion?.removeEventListener?.('change', onMotion); document.removeEventListener('visibilitychange', onVisible); WIND.strength.value = 0; };
  }, [invalidate]);
  return null;
}
