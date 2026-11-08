import { Component, useCallback, useEffect, useState } from 'react';
import AlpinePrototype from './AlpinePrototype.jsx';
import { ALPINE_ASSET_ROOT } from './alpinePrototypeData.js';
import './alpinePrototype.css';
import LookDevPanel from './LookDevPanel.jsx';
import { applyLookQuery } from './lookDev.js';

applyLookQuery(window.location.search);

class PreviewBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <div className="prototype-error">The prototype could not load. <pre>{this.state.error.message}</pre>Run the documented Blender delivery exporter, then reload. The productivity app is unaffected.</div>;
    return this.props.children;
  }
}

export default function LandscapePreview() {
  const params = new URLSearchParams(window.location.search);
  const capture = params.has('capture');
  const [benchmark, setBenchmark] = useState(params.has('benchmark'));
  const [ready, setReady] = useState(false);
  const [compare, setCompare] = useState(params.has('compare'));
  const [vegetation, setVegetation] = useState(params.get('vegetation') !== '0');
  const [waterMode, setWaterMode] = useState(params.get('water') || 'fresnel');
  const look = params.get('look') || 'parity';
  // pass=previous reproduces the renderer before the strip-normal, linear-resolve and flower-filter pass; individual params override it.
  const previousPass = params.get('pass') === 'previous';
  const stripNormals = params.get('strips') || (previousPass ? 'previous' : 'calibrated');
  const flowerFilter = params.get('flowerfilter') || (previousPass ? 'previous' : 'anisotropic');
  const resolve = (params.get('resolve') || (previousPass ? 'display' : 'linear')) === 'display' ? 'display' : 'linear';
  // waterpass=approved reproduces the water and bank exactly as approved before the water refinement.
  const waterPass = params.get('waterpass') || (previousPass ? 'approved' : 'refined');
  const terrainFilter = params.get('terrainfilter') || (previousPass ? 'previous' : 'anisotropic');
  const fillRoots = params.get('fill') || (previousPass ? 'off' : 'on');
  const treeStyle = params.get('trees') || (previousPass ? 'previous' : 'styled');
  const flowerStyle = params.get('flowerstyle') || (previousPass ? 'previous' : 'styled');
  // reflection=previous restores the cached 640x360 near-grass reflection; the default reflects the whole scene at screen-proportional resolution.
  const reflectionMode = params.get('reflection') || (previousPass ? 'previous' : 'real');
  // hamlet=previous restores the authored hamlet mesh; the default is the procedural settlement (yards, lanes, boundaries).
  const hamletStyle = params.get('hamlet') || (previousPass ? 'previous' : 'procedural');
  // meadow=previous removes the middle- and far-ground meadow detail (patches, flower drifts, haze, blade tint).
  const meadowStyle = params.get('meadow') || (previousPass ? 'previous' : 'habitat');
  const surfaceDetail = params.get('detail') !== '0';
  const [metrics, setMetrics] = useState(null);
  // Auto follows the screen's pixel ratio (capped at 2). A fixed 1x made the canvas get stretched on scaled displays: soft, jagged edges.
  const [dprChoice, setDprChoice] = useState(params.get('dpr') || 'auto');
  const dpr = dprChoice === 'auto' ? Math.min(2, window.devicePixelRatio || 1) : Math.min(2, Math.max(.5, Number(dprChoice) || 1));
  const onReady = useCallback(() => setReady(true), [setReady]);
  useEffect(() => {
    function update(event) { setMetrics(event.detail); }
    window.addEventListener('echelon-prototype-metrics', update);
    return () => window.removeEventListener('echelon-prototype-metrics', update);
  }, []);
  return <div className={`alpine-prototype${compare ? ' comparison-mode' : ''}`}>
    <div className="prototype-world"><PreviewBoundary><AlpinePrototype vegetation={vegetation} waterMode={waterMode} look={look} surfaceDetail={surfaceDetail} benchmark={benchmark} dpr={dpr} onReady={onReady} stripNormals={stripNormals} flowerFilter={flowerFilter} resolve={resolve} waterPass={waterPass} terrainFilter={terrainFilter} fillRoots={fillRoots} treeStyle={treeStyle} flowerStyle={flowerStyle} reflectionMode={reflectionMode} hamletStyle={hamletStyle} meadowStyle={meadowStyle} refinement={params.get('refinement') !== 'previous'} corridor={params.get('corridor') !== '0' && params.get('refinement') !== 'previous'} /></PreviewBoundary></div>
    {compare && <><img className="prototype-reference" src={`${ALPINE_ASSET_ROOT}/blender-reference.jpg`} alt="Complete approved Blender hero-camera reference" /><div className="prototype-comparison-labels"><span>Blender reference</span><span>WebGL prototype</span></div></>}
    {!capture && <LookDevPanel />}
    {!capture && <aside className="prototype-panel">
      <strong>Echelon · Blender-authored WebGL prototype</strong>
      <span>{ready ? 'Saved hero camera · sampled authored vegetation · static afternoon' : 'Loading local delivery assets…'}</span>
      <div className="prototype-controls">
        <button onClick={() => setCompare(!compare)}>{compare ? 'WebGL only' : 'Compare complete frames'}</button>
        <label><input type="checkbox" checked={benchmark} onChange={(e) => setBenchmark(e.target.checked)} /> Profile continuously</label><label><input type="checkbox" checked={vegetation} onChange={(e) => setVegetation(e.target.checked)} /> Vegetation</label>
        <label>Resolution <select value={dprChoice} onChange={(e) => setDprChoice(e.target.value)}><option value="auto">Auto (screen)</option><option value="1">1x</option><option value="1.5">1.5x</option><option value="2">2x</option></select></label>
        <label>Water <select value={waterMode} onChange={(e) => setWaterMode(e.target.value)}><option value="fresnel">Depth + Fresnel</option><option value="physical">Physical transmission</option><option value="alpha">Flat alpha comparison</option></select></label>
      </div>
      {!benchmark && ready && <small>Static demand rendering · enable profiling to measure continuous frames</small>}
      {benchmark && metrics && <small>{metrics.drawingBuffer.join(' × ')} · DPR {metrics.dpr} · {metrics.callsAllPasses} draws / {(metrics.trianglesAllPasses / 1e6).toFixed(2)}M triangles across passes<br />
        RAF p50 {metrics.rafP50ms?.toFixed(1) ?? 'warming'} ms · p95 {metrics.rafP95ms?.toFixed(1) ?? '—'} ms · GPU {metrics.gpuP50ms?.toFixed(1) ?? 'unavailable/warming'} ms<br />
        {metrics.samples} warm frame samples · resource counts are not VRAM measurements</small>}
    </aside>}
  </div>;
}
