// Behaviour for the small life (SmallLife.jsx draws it). Each creature is a little state machine stepped on the world clock, so none of them move in
// lockstep and nothing repeats on a fixed timer. Pure JavaScript: no three.js, testable in node.
//
// Butterflies: each species has its own wingbeat and its own mix of flapping and gliding; flight is erratic (the heading wanders, the height
// jumps about between beats) and seeks waypoints over a home patch, now and then hopping further. They land on flower heads and bask, opening
// and closing their wings, and sometimes one chases another for a few seconds. Each has its own warmth threshold, so they come out one by one
// as the sun climbs and settle into the grass one by one as it sinks.
// Birds: loose flocks cross the valley at irregular intervals, more often around dawn and dusk; every bird keeps its own rhythm of wingbeats and
// short glides (so the flock undulates rather than marching), and the formation stretches and drifts. Separately a buzzard now and then glides in,
// circles up a thermal with its wings in a shallow V, banking as it turns, and drifts away again.

export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const approach = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));

// ---------------------------------------------------------------- butterflies
// species: wingbeats per second, seconds of flapping and of gliding (ranges), cruising speed (m/s), cruising height above the ground (m)
const SPECIES = [
  { name: 'brimstone', hz: [8.5, 10], flap: [1.2, 3.5], glide: [0.15, 0.45], speed: 1.35, cruise: 0.95 },
  { name: 'orange-tip', hz: [9, 11], flap: [1.5, 4], glide: [0.1, 0.3], speed: 1.25, cruise: 0.8 },
  { name: 'small white', hz: [10, 12], flap: [2, 5], glide: [0.08, 0.2], speed: 1.15, cruise: 0.85 },
  { name: 'common blue', hz: [11, 13], flap: [0.8, 2], glide: [0.1, 0.25], speed: 0.9, cruise: 0.55 }, // low over the grass, short hops
  { name: 'fritillary', hz: [6.5, 8], flap: [0.5, 1.3], glide: [0.35, 0.9], speed: 1.5, cruise: 1.05 }, // flap-flap-glide
  { name: 'brimstone', hz: [8.5, 10], flap: [1.2, 3.5], glide: [0.15, 0.45], speed: 1.3, cruise: 1.0 },
  { name: 'small tortoiseshell', hz: [7, 8.5], flap: [0.6, 1.6], glide: [0.3, 0.7], speed: 1.45, cruise: 1.0 },
];
const FLOWER_TOP = 0.34; // a perch on a flower head, metres above the ground
const WINGS_CLOSED = 1.45, WINGS_GLIDE = 0.32;

// region: { minX, maxX, minZ, maxZ } the meadow they keep to; groundAt(x, z) -> height or NaN; isLand(x, z) -> may perch there
export function createButterflies(count, { region, groundAt, isLand, seed = 7 }) {
  const rng = mulberry32(seed); const r = (a, b) => a + (b - a) * rng();
  const inRegion = () => ({ x: r(region.minX, region.maxX), z: r(region.minZ, region.maxZ) });
  const ground = (x, z) => { const g = groundAt(x, z); return Number.isFinite(g) ? Math.max(g, 1.85) : 2; };
  const list = Array.from({ length: count }, (_, i) => {
    const s = SPECIES[i % SPECIES.length]; const home = inRegion(); const p = { x: home.x + r(-1.5, 1.5), z: home.z + r(-1.5, 1.5) };
    return { i, s, home, x: p.x, z: p.z, y: ground(p.x, p.z) + FLOWER_TOP, vy: 0, yaw: r(-Math.PI, Math.PI), yawRate: 0, speed: 0, jit: 0,
      state: 'roost', timer: r(0.5, 4), flapping: true, flapTimer: r(...s.flap), phase: r(0, 6.28), hz: r(...s.hz), wing: WINGS_CLOSED, show: 0,
      target: { ...p }, aim: 0, aimTimer: r(0.4, 1.4), flightTime: 0, perchAfter: r(6, 22), bask: 0, baskTimer: r(1, 4), basking: false,
      warmth: 0.1 + 0.2 * ((i * 0.618 + 0.13) % 1), chase: -1, chaseTimer: 0, out: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, wing: 0, scale: 0 } };
  });
  let chaseClock = r(20, 50);
  const newTarget = (b, wide) => { if (wide) { const p = inRegion(); b.target.x = p.x; b.target.z = p.z; b.home = { ...p }; } else { b.target.x = clamp(b.home.x + r(-3, 3), region.minX, region.maxX); b.target.z = clamp(b.home.z + r(-3, 3), region.minZ, region.maxZ); } };
  const takeOff = (b) => { b.state = 'fly'; b.vy = r(0.6, 1.1); b.flapping = true; b.flapTimer = r(...b.s.flap); b.flightTime = 0; b.perchAfter = r(6, 24); newTarget(b, rng() < 0.25); };

  return {
    list,
    // dt: seconds of world time; t: world time; sunY: the sun's height (direction y)
    step(dt, t, sunY) {
      dt = clamp(dt, 0, 0.1);
      // now and then one butterfly takes up the chase of another nearby: a few seconds of spiralling pursuit
      chaseClock -= dt;
      if (chaseClock <= 0) {
        chaseClock = r(25, 70); const flying = list.filter((b) => b.state === 'fly' && b.chase < 0);
        outer: for (const a of flying) for (const b of flying) if (a !== b && Math.hypot(a.x - b.x, a.z - b.z) < 4) { a.chase = b.i; a.chaseTimer = r(3, 7); break outer; }
      }
      for (const b of list) {
        const active = sunY > b.warmth + (b.state === 'roost' ? 0.02 : 0); // a little hysteresis
        if (b.state !== 'fly') b.chase = -1;
        if (b.state === 'roost') {
          b.show = approach(b.show, active ? 1 : 0, 2.5, dt); b.wing = approach(b.wing, WINGS_CLOSED, 4, dt); b.y = ground(b.x, b.z) + FLOWER_TOP;
          if (active && b.show > 0.95) { b.timer -= dt; if (b.timer <= 0) takeOff(b); }
        } else if (b.state === 'perch') {
          b.y = ground(b.x, b.z) + FLOWER_TOP; b.timer -= dt;
          // basking: wings spread to the sun for a while, then closed upright, with small adjustments of the body
          b.baskTimer -= dt; if (b.baskTimer <= 0) { b.basking = !b.basking && sunY > 0.2; b.baskTimer = b.basking ? r(2, 6) : r(0.8, 2.5); if (rng() < 0.3) b.yaw += r(-0.6, 0.6); }
          b.wing = approach(b.wing, b.basking ? 0.12 : WINGS_CLOSED, 3.5, dt);
          if (!active) { if (b.timer > 3) b.timer = 3; if (b.timer <= 0) { b.state = 'roost'; b.timer = r(1, 5); } }
          else if (b.timer <= 0) takeOff(b);
        } else { // fly or land
          if (!active && b.state === 'fly') { b.state = 'land'; const p = { x: b.x + r(-1, 1), z: b.z + r(-1, 1) }; b.target.x = p.x; b.target.z = p.z; }
          if (b.chase >= 0) { const o = list[b.chase]; b.chaseTimer -= dt; if (b.chaseTimer <= 0 || o.state !== 'fly') b.chase = -1; else { b.target.x = o.x + 0.5 * Math.cos(t * 4 + b.i); b.target.z = o.z + 0.5 * Math.sin(t * 4 + b.i); } }
          // wingbeats in bursts with glides between, each species to its own rhythm
          b.flapTimer -= dt; if (b.flapTimer <= 0) { b.flapping = !b.flapping || b.state === 'land' && rng() < 0.5; b.flapTimer = b.flapping ? r(...b.s.flap) : r(...b.s.glide); }
          if (b.flapping) { b.phase += Math.PI * 2 * b.hz * dt; b.wing = 0.12 + 1.15 * (0.5 + 0.5 * Math.sin(b.phase)); } else b.wing = approach(b.wing, WINGS_GLIDE, 12, dt);
          // heading: steer toward the target with a restless wander on top (the zigzag of butterfly flight)
          const dx = b.target.x - b.x, dz = b.target.z - b.z, dist = Math.hypot(dx, dz);
          b.jit += (rng() - 0.5) * dt * 16; b.jit *= Math.exp(-2.2 * dt);
          const want = wrapAngle(Math.atan2(dx, dz) + (b.chase >= 0 ? 0.3 * b.jit : b.jit) * (b.state === 'land' ? 0.3 : 1) - b.yaw);
          const turn = clamp(want * 3.2, -4, 4); b.yawRate = approach(b.yawRate, turn, 8, dt); b.yaw = wrapAngle(b.yaw + b.yawRate * dt);
          const cruise = b.s.speed * (b.chase >= 0 ? 1.35 : 1) * (b.state === 'land' ? clamp(dist / 1.2, 0.25, 1) : 1);
          b.speed = approach(b.speed, b.flapping ? cruise : cruise * 0.8, 3, dt);
          b.x += Math.sin(b.yaw) * b.speed * dt; b.z += Math.cos(b.yaw) * b.speed * dt;
          // height: an aim that jumps about every second or so; flapping climbs toward it, gliding sinks
          const g = ground(b.x, b.z);
          b.aimTimer -= dt; if (b.aimTimer <= 0) { b.aim = r(-0.3, 0.35); b.aimTimer = r(0.4, 1.4); }
          const aimY = b.state === 'land' ? g + FLOWER_TOP : g + b.s.cruise + b.aim;
          const accel = b.flapping ? (aimY - b.y) * 9 + 1.2 * Math.sin(b.phase) * b.hz * 0.5 : -2.2 + Math.max(0, aimY - 0.25 - b.y) * 6;
          b.vy = (b.vy + accel * dt) * Math.exp(-3.5 * dt); b.y = Math.max(b.y + b.vy * dt, g + 0.25);
          b.flightTime += dt;
          if (b.state === 'fly') {
            if (dist < 0.45) newTarget(b, rng() < 0.18);
            if (b.flightTime > b.perchAfter && b.chase < 0) { b.state = 'land'; if (!isLand(b.target.x, b.target.z)) newTarget(b, false); }
          } else if (dist < 0.12 && Math.abs(b.y - aimY) < 0.08) {
            if (isLand(b.x, b.z)) { b.state = 'perch'; b.timer = r(3, 14); b.basking = false; b.baskTimer = r(0.5, 2); b.speed = 0; b.vy = 0; } else newTarget(b, false);
          }
        }
        const airborne = b.state === 'fly' || b.state === 'land';
        const o = b.out; o.x = b.x; o.z = b.z; o.y = b.y + (airborne && b.flapping ? 0.02 * Math.sin(b.phase + 1.6) : 0); /* the body dips and lifts with each beat */ o.yaw = b.yaw; o.wing = b.wing;
        o.pitch = b.state === 'fly' || b.state === 'land' ? clamp(-b.vy * 0.45, -0.45, 0.45) : 0; o.roll = clamp(-b.yawRate * 0.12, -0.5, 0.5);
        o.scale = b.state === 'roost' ? b.show : 1;
      }
    },
  };
}

// ---------------------------------------------------------------- birds
// flock instances 0..flockMax-1, then the buzzard. Outputs per instance: x, y, z, roll (in the view plane), wing (lift: 0 level, + raised), scale (0 hidden)
export function createBirds({ flockMax = 7, seed = 41, firstPass = 25, firstSoar = 45 } = {}) {
  const rng = mulberry32(seed); const r = (a, b) => a + (b - a) * rng();
  const out = Array.from({ length: flockMax + 1 }, () => ({ x: 0, y: 0, z: 0, roll: 0, wing: 0, scale: 0 }));
  const birds = Array.from({ length: flockMax }, () => ({ along: 0, side: 0, up: 0, phaseA: 0, phaseB: 0, flapping: true, beats: 0, glide: 0, phase: 0, hz: 3.5, dy: 0, speedK: 1, alive: false }));
  let flock = null, nextPass = firstPass;
  let soar = null, nextSoar = firstSoar;
  // how lively the sky is: most around sunrise and sunset, fewer in the middle of the day, none at night
  const activity = (sunY) => (sunY < -0.08 ? 0 : 0.45 + 0.55 * (1 - smooth(0.15, 0.45, sunY)) * smooth(-0.08, 0.02, sunY));

  const startFlock = (t) => {
    const dir = rng() < 0.5 ? 1 : -1; const n = 3 + Math.floor(rng() * (flockMax - 2));
    flock = { dir, x: -dir * 240, z: r(-200, -125), y: r(36, 60), speed: r(9, 12), t0: t, n };
    const spread = r(0.6, 1.3);
    birds.forEach((b, i) => {
      b.alive = i < n; b.along = -i * r(4, 11) * spread - r(0, 6); b.side = r(-14, 14) * spread; b.up = r(-5, 5);
      b.phaseA = r(0, 6.28); b.phaseB = r(0, 6.28); b.hz = r(3.2, 4.6); b.flapping = rng() < 0.7; b.beats = 3 + Math.floor(rng() * 5); b.glide = r(0.4, 1.4); b.phase = r(0, 6.28); b.dy = 0; b.speedK = r(0.96, 1.04);
    });
  };
  const startSoar = () => {
    const dir = rng() < 0.5 ? 1 : -1; const c = { x: r(-90, 90), z: r(-220, -150), y: r(32, 50) }; /* low enough to stay in frame (the frame top is ~75 m up at 200 m out) */
    soar = { mode: 'in', x: -dir * 280, y: c.y + r(6, 14), z: c.z + r(-30, 30), c, R: r(32, 50), v: r(8, 9.5), ang: 0, spin: rng() < 0.5 ? 1 : -1, laps: r(2.5, 5.5), turned: 0, dir,
      flapIn: r(10, 30), flaps: 0, phase: 0 };
  };

  return {
    out,
    step(dt, t, sunY, wind = 0.4) {
      dt = clamp(dt, 0, 0.1); const act = activity(sunY);
      // --- flock
      if (!flock && t >= nextPass) { if (act > 0 && rng() < act + 0.2) startFlock(t); else nextPass = t + r(30, 90); }
      if (flock) {
        flock.x += flock.dir * flock.speed * dt; const age = t - flock.t0;
        let anyVisible = false;
        birds.forEach((b, i) => {
          const o = out[i]; if (!b.alive) { o.scale = 0; return; }
          // own rhythm: a run of wingbeats, then a short glide; the body rises on the beats and sinks in the glide
          if (b.flapping) { b.phase += Math.PI * 2 * b.hz * dt; if (b.phase > Math.PI * 2 * b.beats) { b.flapping = false; b.glide = r(0.4, 1.4); b.phase = 0; } }
          else { b.glide -= dt; if (b.glide <= 0) { b.flapping = true; b.beats = 3 + Math.floor(rng() * 5); b.phase = 0; } }
          b.dy = clamp(b.dy + (b.flapping ? 0.7 : -0.9) * dt, -2.5, 2.5);
          b.along += (b.speedK - 1) * flock.speed * dt; // each bird a touch faster or slower: the line slowly stretches or bunches
          const wob = Math.sin(age * 0.23 + b.phaseA) * 5 + Math.sin(age * 0.51 + b.phaseB) * 2.5; // the formation never holds still
          o.x = flock.x + flock.dir * b.along; o.z = flock.z + b.side + wob * 0.8; o.y = flock.y + b.up + b.dy + Math.sin(age * 0.37 + b.phaseB) * 2;
          o.wing = b.flapping ? 0.12 + 0.55 * Math.sin(b.phase) : 0.08 + 0.03 * Math.sin(t * 2 + i); o.roll = 0.12 * Math.sin(age * 0.6 + b.phaseA) - flock.dir * 0.04; o.scale = 1.3;
          if (Math.abs(o.x) < 260) anyVisible = true;
        });
        if (!anyVisible && age > 5) { flock = null; birds.forEach((b, i) => { b.alive = false; out[i].scale = 0; }); nextPass = t + r(55, 220) / Math.max(act, 0.3); }
      }
      // --- buzzard on a thermal (daytime only: thermals need sun)
      const z = out[flockMax];
      if (!soar && t >= nextSoar) { if (sunY > 0.12) startSoar(); else nextSoar = t + 60; }
      if (soar) {
        const s = soar; let vx = 0, vz = 0;
        if (s.mode === 'in') { // glide in toward the edge of the thermal
          const ex = s.c.x - s.dir * s.R, dx = ex - s.x, dz = s.c.z - s.z, d = Math.hypot(dx, dz);
          vx = dx / d * 11; vz = dz / d * 11; s.y = approach(s.y, s.c.y, 0.15, dt);
          if (d < 2) { s.mode = 'circle'; s.ang = Math.atan2(s.x - s.c.x, s.z - s.c.z); }
        } else if (s.mode === 'circle') { // round and round, climbing, the thermal drifting downwind
          const w = s.spin * s.v / s.R; s.ang += w * dt; s.turned += Math.abs(w) * dt; s.c.x += wind * 0.9 * dt; s.c.y = Math.min(s.c.y + 0.22 * dt, 66);
          const nx = s.c.x + Math.sin(s.ang) * s.R, nz = s.c.z + Math.cos(s.ang) * s.R; vx = (nx - s.x) / Math.max(dt, 1e-4); vz = (nz - s.z) / Math.max(dt, 1e-4); s.y = approach(s.y, s.c.y, 0.8, dt);
          if (s.turned > s.laps * Math.PI * 2) { s.mode = 'out'; s.outDir = Math.sign(vx) || s.dir; }
        } else { vx = s.outDir * 13; vz = -2; s.y -= 0.6 * dt; } // glide off down the valley
        s.x += vx * dt; s.z += vz * dt;
        // wings: a shallow V held still; every so often a few slow, deep beats
        s.flapIn -= dt; if (s.flapIn <= 0 && s.flaps === 0) { s.flaps = 3 + Math.floor(rng() * 2); s.phase = 0; s.flapIn = r(12, 35); }
        let wing = 0.3 + 0.03 * Math.sin(t * 1.7); if (s.flaps > 0) { s.phase += Math.PI * 2 * 2.6 * dt; wing = 0.2 + 0.5 * Math.sin(s.phase); if (s.phase > Math.PI * 2 * s.flaps) s.flaps = 0; }
        z.x = s.x; z.y = s.y; z.z = s.z; z.wing = wing; z.scale = 1.6;
        z.roll = s.mode === 'circle' ? -s.spin * 0.3 * Math.cos(s.ang) : 0.05 * Math.sin(t * 0.8); // banked into the turn, seen tilting as it comes round
        if (s.mode === 'out' && Math.abs(s.x) > 300) { soar = null; z.scale = 0; nextSoar = t + r(70, 240); }
      } else z.scale = 0;
    },
    get active() { return Boolean(flock) || Boolean(soar); },
  };
}
