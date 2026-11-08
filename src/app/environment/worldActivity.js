// Shared visibility boundary for wind and live lighting. A disabled wind is
// still a visible scene; obscured/hidden means background rendering can stop.
const activities=new Set(['scenic','work','obscured']);
let activity='scenic';
const listeners=new Set();
export const getWorldActivity=()=>activity;
export function setWorldActivity(next){
  const value=activities.has(next)?next:'scenic';
  if(value===activity)return;activity=value;listeners.forEach(fn=>fn());
}
export const subscribeWorldActivity=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export function isWorldVisible(hidden=typeof document!=='undefined'&&document.hidden){
  return !hidden&&activity!=='obscured';
}
