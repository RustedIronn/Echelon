import test from 'node:test';
import assert from 'node:assert/strict';
import { communityAt, COMMUNITIES, VIGNETTE } from '../src/app/environment/meadowCommunities.js';

test('flowering communities are deterministic, bounded, confined to their window and varied in kind', () => {
  const kinds = new Set(); let inside = 0, strong = 0;
  for (let z = VIGNETTE.z0; z <= VIGNETTE.z1; z += 3) for (let x = VIGNETTE.x0; x <= VIGNETTE.x1; x += 3) {
    const a = communityAt(x, z, 0.1), b = communityAt(x, z, 0.1);
    assert.deepEqual(a, b); assert.ok(a.strength >= 0 && a.strength <= 1.0001); assert.ok(a.kind >= 0 && a.kind < COMMUNITIES.length);
    inside += 1; if (a.strength > 0.5) { strong += 1; kinds.add(a.kind); }
  }
  assert.ok(kinds.size >= 3, 'at least three different communities');
  assert.ok(strong / inside > 0.12 && strong / inside < 0.6, 'drifts cover part of the meadow, not all of it');
  assert.equal(communityAt(VIGNETTE.x0 - 30, -80).strength, 0); assert.equal(communityAt(20, VIGNETTE.z1 + 30).strength, 0);
});

test('wet ground favours buttercups', () => {
  let wet = 0, dry = 0, wetN = 0, dryN = 0;
  for (let z = -130; z <= -40; z += 3) for (let x = -5; x <= 95; x += 3) { const w = communityAt(x, z, 0.8), d = communityAt(x, z, 0); if (w.strength > 0.3) { wetN += 1; if (w.kind === 0) wet += 1; } if (d.strength > 0.3) { dryN += 1; if (d.kind === 0) dry += 1; } }
  assert.ok(wet / wetN > dry / dryN);
});
