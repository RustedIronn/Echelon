import test from 'node:test';
import assert from 'node:assert/strict';
import { animationFps, windWanted } from '../src/app/environment/wind.js';

test('animation cadence: 60 fps viewing, 30 behind panels, paused when obscured, hidden or without wind; wind off with ?wind=0', () => {
  assert.equal(animationFps({ activity: 'scenic' }), 60); assert.equal(animationFps({ activity: 'work' }), 30);
  assert.equal(animationFps({ activity: 'obscured' }), 0); assert.equal(animationFps({ activity: 'scenic', hidden: true }), 0);
  assert.equal(animationFps({ activity: 'work', hidden: true }), 0); assert.equal(animationFps({ activity: 'scenic', wind: false }), 0);
  assert.equal(animationFps({ activity: 'nonsense' }), 60);
  assert.equal(windWanted(''), true); assert.equal(windWanted('?wind=0'), false); assert.equal(windWanted('?wind=1'), true);
});
