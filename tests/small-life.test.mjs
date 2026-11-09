import test from 'node:test';
import assert from 'node:assert/strict';
import { createButterflies, createBirds } from '../src/app/environment/smallLifeMotion.js';

const region = { minX: -11, maxX: 0, minZ: -6, maxZ: 4 };
const flat = () => 2.0;

test('butterflies: come out in sunshine, fly, perch and bask, stay near their meadow, and settle out of sight at night', () => {
  const swarm = createButterflies(7, { region, groundAt: flat, isLand: () => true });
  const states = new Set(); let maxOut = 0; let wingsMoved = 0; let lastWing = null;
  for (let f = 0; f < 60 * 240; f += 1) { // four minutes of a sunny day at 60 fps
    swarm.step(1 / 60, f / 60, 0.6);
    for (const b of swarm.list) {
      states.add(b.state); const o = b.out;
      for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'wing', 'scale']) assert.ok(Number.isFinite(o[k]), `${k} finite`);
      maxOut = Math.max(maxOut, region.minX - o.x, o.x - region.maxX, region.minZ - o.z, o.z - region.maxZ);
      assert.ok(o.y >= 2.0 + 0.2, 'never sinks into the ground');
    }
    const w = swarm.list[0].out.wing; if (lastWing !== null && Math.abs(w - lastWing) > 1e-3) wingsMoved += 1; lastWing = w;
  }
  assert.ok(states.has('fly') && states.has('perch'), `flies and perches (${[...states]})`);
  assert.ok(maxOut < 4, `keeps to the meadow (strayed ${maxOut.toFixed(2)} m)`);
  assert.ok(wingsMoved > 1000, 'wings move');
  // speeds differ between species: compare flap rates
  assert.notEqual(swarm.list[0].hz.toFixed(2), swarm.list[4].hz.toFixed(2));
  // dusk falls: all of them settle and vanish into the grass within a couple of minutes
  for (let f = 0; f < 60 * 150; f += 1) swarm.step(1 / 60, 240 + f / 60, 0.0);
  assert.ok(swarm.list.every((b) => b.state === 'roost' && b.out.scale < 0.05), 'all roosting at night');
});

test('birds: flocks cross at irregular intervals with each bird on its own rhythm; a buzzard circles on a thermal by day', () => {
  const birds = createBirds({ flockMax: 7, firstPass: 5, firstSoar: 10 });
  const passStarts = []; let wasFlock = false; let maxPhaseSpread = 0; let soarSeen = false; let rollRange = [0, 0];
  for (let f = 0; f < 60 * 1200; f += 1) { // twenty minutes, morning sun
    const t = f / 60; birds.step(1 / 60, t, 0.25, 0.4);
    const flockOut = birds.out.slice(0, 7).filter((o) => o.scale > 0);
    const isFlock = flockOut.length > 0; if (isFlock && !wasFlock) passStarts.push(t); wasFlock = isFlock;
    if (flockOut.length > 2) { const w = flockOut.map((o) => o.wing); maxPhaseSpread = Math.max(maxPhaseSpread, Math.max(...w) - Math.min(...w)); }
    const z = birds.out[7]; if (z.scale > 0) { soarSeen = true; rollRange = [Math.min(rollRange[0], z.roll), Math.max(rollRange[1], z.roll)]; }
    for (const o of birds.out) for (const k of ['x', 'y', 'z', 'roll', 'wing']) assert.ok(Number.isFinite(o[k]));
  }
  assert.ok(passStarts.length >= 3, `several flocks (${passStarts.length})`);
  const gaps = passStarts.slice(1).map((t, i) => t - passStarts[i]); const spread = Math.max(...gaps) - Math.min(...gaps);
  assert.ok(spread > 20, `irregular intervals (${gaps.map((g) => g.toFixed(0))})`);
  assert.ok(maxPhaseSpread > 0.3, 'wingbeats are not in lockstep');
  assert.ok(soarSeen && rollRange[1] - rollRange[0] > 0.3, 'the buzzard soars and banks');
  // night: the sky empties
  const night = createBirds({ firstPass: 1, firstSoar: 1 });
  for (let f = 0; f < 60 * 300; f += 1) night.step(1 / 60, f / 60, -0.3);
  assert.equal(night.active, false);
});
