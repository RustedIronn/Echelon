const SYNODIC_MONTH_DAYS = 29.53059;
// NASA's commonly used 2000 epoch for an approximate new moon. This is a
// visual phase model, not a location-aware astronomical ephemeris.
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(start, end, value) {
  const amount = clamp((value - start) / (end - start));
  return amount * amount * (3 - (2 * amount));
}

export function createSeededRandom(seed = 11939) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let output = value;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
}

export function createStarField(count = 68, seed = 77131) {
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, () => ({
    // Keep the horizon clear and avoid a regular wallpaper distribution.
    x: .04 + (random() * .92),
    y: .045 + ((random() ** 1.8) * .39),
    radius: .20 + (random() * .52),
    brightness: .24 + (random() * .68),
  }));
}

export const STAR_FIELD = Object.freeze(createStarField());

export function getLunarPhase(date = new Date()) {
  const ageDays = ((((date.getTime() - REFERENCE_NEW_MOON) / 86_400_000) % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
  const fraction = ageDays / SYNODIC_MONTH_DAYS;
  const illumination = (1 - Math.cos(fraction * Math.PI * 2)) / 2;
  const waxing = fraction < .5;
  const phaseName = illumination < .03
    ? "new"
    : illumination > .97
      ? "full"
      : illumination < .48
        ? (waxing ? "waxing-crescent" : "waning-crescent")
        : illumination < .55
          ? (waxing ? "first-quarter" : "last-quarter")
          : (waxing ? "waxing-gibbous" : "waning-gibbous");

  return Object.freeze({ ageDays, fraction, illumination, waxing, phaseName });
}

export function getCelestialVisibility(minuteOfDay) {
  const daylight = smoothstep(5 * 60, (5 * 60) + 36, minuteOfDay)
    * (1 - smoothstep((16 * 60) + 18, 17 * 60, minuteOfDay));
  const twilight = smoothstep((16 * 60) + 30, 20 * 60, minuteOfDay);
  const lateNight = smoothstep(5 * 60, (5 * 60) + 42, minuteOfDay);
  const night = minuteOfDay >= 20 * 60
    ? smoothstep(20 * 60, (20 * 60) + 54, minuteOfDay)
    : 1 - lateNight;
  const earlyStars = smoothstep((17 * 60) + 18, (18 * 60) + 18, minuteOfDay)
    * (1 - smoothstep(20 * 60, (20 * 60) + 18, minuteOfDay));
  const starVisibility = clamp(night * .92);

  return Object.freeze({
    sun: clamp(daylight),
    moon: clamp((night * .9) + (twilight * .62)),
    stars: starVisibility,
    earlyStars: clamp(earlyStars),
  });
}

export function getSunPosition(minuteOfDay) {
  const arc = clamp((minuteOfDay - (5 * 60)) / (12 * 60));
  return Object.freeze({
    x: .18 + (.66 * arc),
    y: .41 - (.25 * Math.sin(Math.PI * arc)),
  });
}

export function getMoonPosition(minuteOfDay) {
  const nightProgress = minuteOfDay >= 20 * 60
    ? (minuteOfDay - (20 * 60)) / (9 * 60)
    : (minuteOfDay + (4 * 60)) / (9 * 60);
  const arc = clamp(nightProgress);
  return Object.freeze({
    x: .72 - (.32 * arc),
    y: .29 - (.12 * Math.sin(Math.PI * arc)),
  });
}

export function getCelestialState(date = new Date()) {
  const minuteOfDay = (date.getHours() * 60) + date.getMinutes() + (date.getSeconds() / 60);
  return Object.freeze({
    minuteOfDay,
    visibility: getCelestialVisibility(minuteOfDay),
    sun: getSunPosition(minuteOfDay),
    moon: getMoonPosition(minuteOfDay),
    lunarPhase: getLunarPhase(date),
  });
}
