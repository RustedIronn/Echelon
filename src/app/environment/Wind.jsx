import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import {getWorldActivity,setWorldActivity,isWorldVisible} from './worldActivity.js';
import { WIND, windWanted, animationFps, prefersReducedMotion } from './wind.js';

// The animation governor. The scene renders on demand; while wind is on, this asks for frames at a cadence set by how the world is being viewed:
// 60 fps while the landscape is looked at, 30 fps behind UI panels, none while it is obscured or the tab is hidden (it still redraws on any change).
// The host app sets the activity with window.__echelonWorld.setActivity('scenic' | 'work' | 'obscured'); the preview accepts ?activity=work.
// Wind time follows the wall clock, so lowering or pausing the cadence never makes the sway jump or speed up afterwards.
export default function Wind() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const previousActivity=getWorldActivity();
    setWorldActivity(params.get('activity')||'scenic');
    const state = { wind: windWanted() };
    const start = performance.now(); let raf = 0, last = 0;
    const apply=()=>{
      cancelAnimationFrame(raf);raf=0;WIND.strength.value=state.wind?1:0;
      if(isWorldVisible()){
        WIND.time.value=(performance.now()-start)/1000;invalidate();
        if(state.wind)raf=requestAnimationFrame(tick);
      }
    };
    const tick = (now) => {
      raf=0;const fps=animationFps({activity:getWorldActivity(),hidden:document.hidden,wind:state.wind});if(!fps)return;
      raf=requestAnimationFrame(tick);
      if (now - last < 1000 / fps - 2) return; // 2 ms tolerance keeps 60 fps on a 60 Hz display
      last = now; WIND.time.value = (now - start) / 1000; invalidate();
    };
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)'); const onMotion = () => { state.wind = windWanted(); apply(); };
    motion?.addEventListener?.('change', onMotion);
    const onVisible = apply; document.addEventListener('visibilitychange', onVisible);
    const previousApi=window.__echelonWorld;
    const api = { ...(previousApi || {}),
      setActivity: activity=>{setWorldActivity(activity);apply();},
      setWind: (on) => { state.wind = Boolean(on) && !prefersReducedMotion(); apply(); },
      get animation() { return { activity: getWorldActivity(), wind: state.wind, fps: animationFps({ activity: getWorldActivity(), hidden: document.hidden, wind: state.wind }) }; } };
    window.__echelonWorld=api;apply();
    return () => { cancelAnimationFrame(raf); motion?.removeEventListener?.('change', onMotion); document.removeEventListener('visibilitychange', onVisible); WIND.strength.value = 0;if(window.__echelonWorld===api)window.__echelonWorld=previousApi;setWorldActivity(previousActivity); };
  }, [invalidate]);
  return null;
}
