import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { currentMoment, formatHour, getTod, liveHour, moonIllumination, moonPhase, setTod, solarDay, subscribeTod } from './timeOfDay.js';

// The viewer: a small bar under the scene for looking at the place rather than tuning it. A scrubber across the day (night, dawn, daylight and
// dusk drawn on the track, the sun's and moon's positions marked), the date (which sets the moon's phase), a Live button that follows the clock,
// and Play, which runs the day as a time-lapse. The developer panels stay one key away (D).
const SPEEDS = [{ label: '1 min', seconds: 60 }, { label: '3 min', seconds: 180 }, { label: '10 s', seconds: 10 }]; // how long a whole day takes
const MOON_GLYPHS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];

export default function ViewerBar() {
  const tod = useSyncExternalStore(subscribeTod, getTod);
  const [playing, setPlaying] = useState(false); const [speed, setSpeed] = useState(0); const [, tick] = useState(0);
  const moment = currentMoment() ?? new Date(); const solar = solarDay(moment); const phase = moonPhase(moment);
  const hour = tod.mode === 'manual' ? Number(tod.hour) : liveHour();
  const clock = useRef({ hour, last: 0 }); clock.current.hour = hour;

  // the time-lapse: advance the hour about twelve times a second (each change relights the scene, so not every frame)
  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0, last = performance.now(), acc = 0;
    const step = (now) => { const dt = (now - last) / 1000; last = now; acc += dt; if (acc >= 1 / 12) { const h = (clock.current.hour + (acc * 24) / SPEEDS[speed].seconds) % 24; acc = 0; setTod({ mode: 'manual', hour: h, date: getTod().date }); } raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [playing, speed]);
  // in live mode, keep the readout moving with the clock
  useEffect(() => { if (tod.mode !== 'live') return undefined; const id = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(id); }, [tod.mode]);

  const pct = (h) => `${((((h % 24) + 24) % 24) / 24) * 100}%`;
  const rise = solar.sunrise, set = solar.sunset;
  // the track: deep blue night, a warm band at dawn and dusk, pale daylight between
  const track = `linear-gradient(90deg, #1b2442 0%, #1b2442 ${pct(rise - 1.2)}, #c98f86 ${pct(rise)}, #9cc4e8 ${pct(rise + 1.2)}, #a9cdee ${pct(set - 1.2)}, #e3a175 ${pct(set)}, #2c3359 ${pct(set + 1.2)}, #1b2442 100%)`;
  const lit = Math.round(moonIllumination(phase) * 100); const glyph = MOON_GLYPHS[Math.round(phase * 8) % 8];
  const scrub = (h) => { setPlaying(false); setTod({ mode: 'manual', hour: h, date: tod.date }); };

  return <div className="viewer-bar" role="toolbar" aria-label="Time of day">
    <button className={`viewer-play${playing ? ' on' : ''}`} onClick={() => { if (tod.mode !== 'manual') setTod({ mode: 'manual', hour, date: tod.date }); setPlaying(!playing); }} title={playing ? 'Pause' : 'Play the day as a time-lapse'} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
    <button className="viewer-speed" onClick={() => setSpeed((speed + 1) % SPEEDS.length)} title="How long a whole day takes">day in {SPEEDS[speed].label}</button>
    <div className="viewer-track" style={{ background: track }}>
      <span className="viewer-mark" style={{ left: pct(rise) }} title={`Sunrise ${formatHour(rise)}`} />
      <span className="viewer-mark" style={{ left: pct(set) }} title={`Sunset ${formatHour(set)}`} />
      <input type="range" min="0" max="24" step="0.01" value={hour} onChange={(e) => scrub(Number(e.target.value))} aria-label="Hour" />
    </div>
    <span className="viewer-time">{formatHour(hour)}</span>
    <button className={`viewer-live${tod.mode === 'live' ? ' on' : ''}`} onClick={() => { setPlaying(false); setTod({ mode: 'live' }); }} title="Follow this device's clock">Live</button>
    <label className="viewer-date" title="The date sets the moon's phase and the length of the day">
      <input type="date" value={tod.date} onChange={(e) => { setPlaying(false); setTod({ mode: 'manual', hour, date: e.target.value }); }} />
    </label>
    <span className="viewer-moon" title={`Moon ${lit}% lit, ${phase < 0.5 ? 'waxing' : 'waning'}`}>{glyph} {lit}%</span>
  </div>;
}
