import { getToday } from "../../shared/date.js";
import { mergeWorkoutHistories } from "./workoutStorage.js";

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
  const [year, month, day] = String(date).split("-").map(Number);
  const localDate = new Date(year, month - 1, day);

  if (getToday(localDate) !== date) return date;

  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(localDate);
}

export function getRecordedExercises(session) {
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
