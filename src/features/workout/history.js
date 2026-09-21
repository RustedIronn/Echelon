import { getToday, parseDayKey } from "../../shared/date.js";
import { mergeWorkoutHistories } from "./workoutStorage.js";
import { normalizeCompletedTracking } from "./tracking.js";
import { normalizeCompletedRunnerSummary } from "./runner.js";

export function sortWorkoutHistory(sessions, direction = "desc") {
  const safeSessions = mergeWorkoutHistories(sessions, []);
  const multiplier = direction === "asc" ? 1 : -1;

  return [...safeSessions].sort(
    (first, second) => first.date.localeCompare(second.date) * multiplier,
  );
}

export function groupWorkoutHistoryByDate(sessions) {
  return sortWorkoutHistory(sessions, "asc").reduce((groups, session) => {
    if (!groups[session.date]) groups[session.date] = [];
    groups[session.date].push(session);
    return groups;
  }, {});
}

export function getAdjacentWorkoutDates(sessions, date) {
  const dates = Object.keys(groupWorkoutHistoryByDate(sessions)).sort();
  const index = dates.indexOf(date);

  if (index === -1) return { previous: null, next: null };

  return {
    previous: dates[index - 1] ?? null,
    next: dates[index + 1] ?? null,
  };
}

export function shiftCalendarMonth({ year, month }, offset) {
  const shifted = new Date(year, month + offset, 1);

  return {
    year: shifted.getFullYear(),
    month: shifted.getMonth(),
  };
}

export function getCalendarMonth(year, month) {
  if (
    !Number.isInteger(year) ||
    year < 1000 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 0 ||
    month > 11
  ) {
    return [];
  }

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;

    if (day < 1 || day > daysInMonth) return null;

    return {
      day,
      date: getToday(new Date(year, month, day)),
    };
  });
}

export function formatWorkoutDate(date) {
  const localDate = parseDayKey(date);
  if (!localDate) return date;

  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(localDate);
}

export function getRecordedExercises(session) {
  const runner = normalizeCompletedRunnerSummary(session?.runner);
  if (runner) {
    const unique = new Map();
    for (const item of [...runner.completed, ...runner.skipped]) {
      if (!unique.has(item.exerciseId)) unique.set(item.exerciseId, item.name);
    }
    return [...unique.values()];
  }
  const tracking = normalizeCompletedTracking(session?.tracking);
  if (tracking) return tracking.exercises.map((exercise) => exercise.name);

  if (!Array.isArray(session?.exercises)) return [];

  return session.exercises
    .map((exercise) =>
      typeof exercise === "string" ? exercise : exercise?.name,
    )
    .filter((name) => typeof name === "string" && name.trim());
}

export function formatWorkoutDuration(duration) {
  const seconds = Number(duration);

  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 60) return `${Math.floor(seconds)} sec`;

  return `${Math.floor(seconds / 60)} min`;
}
