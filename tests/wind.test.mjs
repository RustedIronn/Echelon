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

import {getWorldActivity,setWorldActivity,isWorldVisible,subscribeWorldActivity} from '../src/app/environment/worldActivity.js';

test('visibility gates the whole backdrop independently of wind, and notifies on resume',()=>{
  const previous=getWorldActivity();let changes=0;const unsubscribe=subscribeWorldActivity(()=>changes++);
  try{
    setWorldActivity('scenic');const before=changes;
    assert.equal(isWorldVisible(false),true);
    setWorldActivity('obscured');assert.equal(isWorldVisible(false),false);
    setWorldActivity('obscured');assert.equal(changes,before+1);
    setWorldActivity('work');assert.equal(isWorldVisible(false),true);assert.equal(isWorldVisible(true),false);
    assert.equal(animationFps({activity:getWorldActivity(),wind:false}),0);assert.equal(isWorldVisible(false),true,'no wind must not pause visible live lighting');
    setWorldActivity('toString');assert.equal(getWorldActivity(),'scenic');
    unsubscribe();const after=changes;setWorldActivity('work');assert.equal(changes,after);
  }finally{unsubscribe();setWorldActivity(previous);}
});
