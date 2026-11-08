import { useEffect, useState, useSyncExternalStore } from 'react';
import { currentMoment, formatHour, getTod, liveHour, moonIllumination, moonPhase, setTod, solarDay, subscribeTod } from './timeOfDay.js';
import { LOOK_CONTROLS, LOOK_DEFAULTS, changedLook, getLookValues, holdApproved, isApprovedHeld, lookToQuery, resetLook, setLook, subscribeLook } from './lookDev.js';

const GROUPS = ['Light', 'Scene', 'Vegetation', 'Water'];

// Live look-dev controls for the isolated preview. Hold H (or the button) to flash the approved look for comparison, L to hide the panel.
export default function LookDevPanel() {
  const values = useSyncExternalStore(subscribeLook, getLookValues);
  const held = useSyncExternalStore(subscribeLook, isApprovedHeld);
  const tod = useSyncExternalStore(subscribeTod, getTod);
  const [visible, setVisible] = useState(true);
  const [notice, setNotice] = useState('');
  const changed = Object.keys(changedLook(values)).length;

  useEffect(() => {
    const typing = (event) => /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) && event.target.type !== 'range';
    const down = (event) => {
      if (event.repeat || typing(event)) return;
      if (event.key === 'h' || event.key === 'H') holdApproved(true);
      if (event.key === 'l' || event.key === 'L') setVisible((v) => !v);
    };
    const up = (event) => { if (event.key === 'h' || event.key === 'H') holdApproved(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const flash = (text) => { setNotice(text); window.setTimeout(() => setNotice(''), 1800); };
  const copy = async (text, label) => { try { await navigator.clipboard.writeText(text); flash(`${label} copied`); } catch { flash('Copy blocked by the browser'); } };
  const link = () => {
    const url = new URL(window.location.href); url.searchParams.delete('ld'); const query = lookToQuery(values);
    return query ? `${url.origin}${url.pathname}?${url.searchParams.toString() ? `${url.searchParams.toString()}&` : ''}ld=${query}` : url.toString();
  };

  if (!visible) return <button className="lookdev-tab" onClick={() => setVisible(true)}>Look-dev (L)</button>;
  return <aside className="lookdev-panel">
    <header>
      <strong>Look-dev</strong>
      <span>{held ? 'Showing the approved look' : changed ? `${changed} changed` : 'Approved look'}</span>
    </header>
    <div className="lookdev-actions">
      <button onPointerDown={() => holdApproved(true)} onPointerUp={() => holdApproved(false)} onPointerLeave={() => holdApproved(false)} title="Hold to compare (or hold H)">Hold: approved</button>
      <button onClick={resetLook}>Reset all</button>
      <button onClick={() => copy(JSON.stringify(changedLook(values), null, 2), 'Settings')}>Copy settings</button>
      <button onClick={() => copy(link(), 'Link')}>Copy link</button>
    </div>
    {notice && <p className="lookdev-notice">{notice}</p>}
    <section>
      <h4>Time of day</h4>
      {(() => {
        const moment = currentMoment() ?? new Date(); const solar = solarDay(moment); const phase = moonPhase(moment); const shownHour = tod.mode === 'live' ? liveHour() : tod.mode === 'manual' ? tod.hour : liveHour();
        const presets = [['Dawn', solar.sunrise - 0.4], ['Morning', solar.sunrise + 1.5], ['Noon', solar.noon], ['Afternoon', solar.sunset - 2.6], ['Late', solar.sunset - 1.0], ['Dusk', solar.sunset + 0.45], ['Twilight', solar.sunset + 1.1], ['Night', solar.sunset + 3.5], ['Midnight', 0.5]];
        return <>
          <div className="lookdev-actions">
            <button className={tod.mode === 'approved' ? 'active' : ''} onClick={() => setTod({ mode: 'approved' })} title="The earlier renderer, for comparison">Approved</button>
            <button className={tod.mode === 'live' ? 'active' : ''} onClick={() => setTod({ mode: 'live' })} title="Follow this device's clock">Live clock</button>
            {presets.map(([label, hour]) => <button key={label} className={tod.mode === 'manual' && Math.abs(tod.hour - hour) < 0.01 ? 'active' : ''} onClick={() => setTod({ mode: 'manual', hour })}>{label}</button>)}
          </div>
          <label><span>Hour<output>{tod.mode === 'approved' ? 'approved' : formatHour(shownHour)}</output></span>
            <input type="range" min="0" max="24" step="0.05" value={shownHour} onChange={(e) => setTod({ mode: 'manual', hour: e.target.value })} /></label>
          <label><span>Date<output>{tod.mode === 'live' ? 'today' : tod.date}</output></span>
            <input type="date" value={tod.date} onChange={(e) => setTod({ mode: 'manual', hour: shownHour, date: e.target.value })} /></label>
          <p className="lookdev-help">Sunrise {formatHour(solar.sunrise)}, sunset {formatHour(solar.sunset)}. Moon {Math.round(moonIllumination(phase) * 100)}% lit, {phase < 0.5 ? 'waxing' : 'waning'}.</p>
        </>;
      })()}
    </section>
    {GROUPS.map((group) => <section key={group}>
      <h4>{group}</h4>
      {LOOK_CONTROLS.filter((c) => c.group === group).map((c) => {
        const isChanged = Math.abs(values[c.key] - LOOK_DEFAULTS[c.key]) > 1e-9;
        return <label key={c.key} className={isChanged ? 'changed' : ''} title={`${c.hint}. Double-click to reset.`}>
          <span>{c.label}<output>{values[c.key].toFixed(2)}</output></span>
          <input type="range" min={c.min} max={c.max} step={c.step} value={values[c.key]} onChange={(e) => setLook(c.key, e.target.value)} onDoubleClick={() => setLook(c.key, LOOK_DEFAULTS[c.key])} />
        </label>;
      })}
    </section>)}
    <p className="lookdev-help">Hold H to flash the approved look. L hides this panel. Water controls act on the refined water.</p>
  </aside>;
}
