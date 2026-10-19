import { useEffect, useState } from "react";

const MINUTES_IN_DAY = 24 * 60;
const PREVIEW_MINUTES = Object.freeze({
  morning: 8 * 60,
  afternoon: 14 * 60,
  evening: (18 * 60) + 30,
  night: 22 * 60,
});

const LIGHTING_KEYFRAMES = Object.freeze([
  {
    minute: 0,
    mood: "night",
    skyTop: [10, 25, 63], skyHorizon: [43, 65, 108], skyGlow: [123, 151, 201],
    meadowFar: [92, 116, 107], meadowNear: [37, 70, 73], water: [49, 88, 122],
    lightDirection: [.16, .57, -.16], ambient: .66, contrast: .68, haze: .18,
  },
  {
    minute: 5 * 60,
    mood: "morning",
    skyTop: [113, 157, 193], skyHorizon: [249, 216, 177], skyGlow: [255, 228, 176],
    meadowFar: [174, 190, 137], meadowNear: [74, 105, 72], water: [97, 138, 150],
    lightDirection: [.34, .79, -.30], ambient: .76, contrast: .86, haze: .27,
  },
  {
    minute: (9 * 60) + 30,
    mood: "morning",
    skyTop: [125, 184, 216], skyHorizon: [237, 232, 199], skyGlow: [255, 241, 201],
    meadowFar: [183, 204, 145], meadowNear: [74, 116, 73], water: [92, 145, 150],
    lightDirection: [.43, .87, -.32], ambient: .88, contrast: .98, haze: .18,
  },
  {
    minute: 12 * 60,
    mood: "afternoon",
    skyTop: [83, 160, 217], skyHorizon: [213, 231, 221], skyGlow: [237, 247, 225],
    meadowFar: [174, 204, 132], meadowNear: [61, 116, 67], water: [76, 139, 151],
    lightDirection: [.30, .93, -.25], ambient: .98, contrast: 1.10, haze: .09,
  },
  {
    minute: 16 * 60,
    mood: "afternoon",
    skyTop: [93, 158, 202], skyHorizon: [224, 224, 190], skyGlow: [250, 239, 196],
    meadowFar: [180, 197, 126], meadowNear: [66, 111, 66], water: [79, 135, 145],
    lightDirection: [.54, .82, -.22], ambient: .91, contrast: 1.02, haze: .13,
  },
  {
    minute: 17 * 60,
    mood: "evening",
    skyTop: [116, 154, 191], skyHorizon: [243, 191, 171], skyGlow: [255, 214, 181],
    meadowFar: [177, 190, 137], meadowNear: [79, 109, 78], water: [99, 134, 146],
    lightDirection: [.58, .70, -.20], ambient: .86, contrast: .90, haze: .22,
  },
  {
    minute: (19 * 60) + 45,
    mood: "evening",
    skyTop: [79, 107, 154], skyHorizon: [195, 153, 175], skyGlow: [225, 180, 191],
    meadowFar: [128, 145, 119], meadowNear: [54, 86, 78], water: [80, 114, 138],
    lightDirection: [.31, .58, -.18], ambient: .74, contrast: .74, haze: .25,
  },
  {
    minute: 20 * 60,
    mood: "night",
    skyTop: [20, 44, 91], skyHorizon: [74, 89, 137], skyGlow: [145, 164, 210],
    meadowFar: [99, 121, 111], meadowNear: [40, 75, 77], water: [55, 94, 126],
    lightDirection: [.20, .61, -.16], ambient: .67, contrast: .70, haze: .21,
  },
]);

function mix(first, second, amount) {
  return first.map((channel, index) => channel + ((second[index] - channel) * amount));
}

function interpolate(first, second, amount) {
  const eased = amount * amount * (3 - (2 * amount));
  return {
    mood: amount < .5 ? first.mood : second.mood,
    skyTop: mix(first.skyTop, second.skyTop, eased),
    skyHorizon: mix(first.skyHorizon, second.skyHorizon, eased),
    skyGlow: mix(first.skyGlow, second.skyGlow, eased),
    meadowFar: mix(first.meadowFar, second.meadowFar, eased),
    meadowNear: mix(first.meadowNear, second.meadowNear, eased),
    water: mix(first.water, second.water, eased),
    lightDirection: mix(first.lightDirection, second.lightDirection, eased),
    ambient: first.ambient + ((second.ambient - first.ambient) * eased),
    contrast: first.contrast + ((second.contrast - first.contrast) * eased),
    haze: first.haze + ((second.haze - first.haze) * eased),
  };
}

function localMinutes(date) {
  return (date.getHours() * 60) + date.getMinutes() + (date.getSeconds() / 60);
}

export function getEnvironmentLighting(date = new Date()) {
  const minute = localMinutes(date);
  const keyframes = LIGHTING_KEYFRAMES;
  const followingIndex = keyframes.findIndex((frame) => frame.minute > minute);
  const afterIndex = followingIndex === -1 ? 0 : followingIndex;
  const beforeIndex = afterIndex === 0 ? keyframes.length - 1 : afterIndex - 1;
  const before = keyframes[beforeIndex];
  const after = keyframes[afterIndex];
  const start = before.minute;
  const end = afterIndex === 0 ? after.minute + MINUTES_IN_DAY : after.minute;
  const current = minute < start ? minute + MINUTES_IN_DAY : minute;
  return Object.freeze(interpolate(before, after, (current - start) / (end - start)));
}

export function getDevelopmentPreviewLighting(search = "") {
  if (!import.meta.env.DEV) return null;
  const sky = new URLSearchParams(search).get("sky");
  const minute = PREVIEW_MINUTES[sky];
  if (minute === undefined) return null;
  const previewDate = new Date(2025, 0, 1, 0, minute, 0);
  return getEnvironmentLighting(previewDate);
}

export function useEnvironmentLighting() {
  const [lighting, setLighting] = useState(() => getEnvironmentLighting());

  useEffect(() => {
    let timerId;
    const scheduleNextUpdate = () => {
      window.clearTimeout(timerId);
      const now = new Date();
      const delay = (60_000 - (now.getSeconds() * 1_000) - now.getMilliseconds()) + 32;
      timerId = window.setTimeout(updateLighting, delay);
    };
    const updateLighting = () => {
      setLighting(getEnvironmentLighting());
      scheduleNextUpdate();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") updateLighting();
    };

    updateLighting();
    window.addEventListener("focus", updateLighting);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("focus", updateLighting);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  return lighting;
}
