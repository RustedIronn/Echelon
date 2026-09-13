import { getToday } from "./date.js";

export const DAY_ROLLOVER_EVENT = "echelon:day-rollover";

export function hasLocalDayChanged(previousDay, now = new Date()) {
  return previousDay !== getToday(now);
}

export function getMillisecondsUntilNextLocalDay(now = new Date()) {
  const nextDay = new Date(now);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);

  return Math.max(0, nextDay.getTime() - now.getTime());
}
