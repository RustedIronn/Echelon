import { workouts } from "./constants.js";
import { getToday } from "../../shared/date.js";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const parseLocalDayKey = (dayKey) => {
  if (typeof dayKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    return null;
  }

  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return getToday(date) === dayKey ? date : null;
};

export function isValidWorkoutPlanDate(dayKey) {
  return parseLocalDayKey(dayKey) !== null;
}

export function getDefaultWorkoutPlanDate(now = new Date()) {
  return getToday(now);
}

export function shiftWorkoutPlanDate(dayKey, offset) {
  const date = parseLocalDayKey(dayKey);
  if (!date || !Number.isInteger(offset)) return null;

  date.setDate(date.getDate() + offset);
  return getToday(date);
}

export function getWorkoutForDate(dayKey) {
  const date = parseLocalDayKey(dayKey);
  if (!date) return null;

  return workouts.find((workout) => workout.day === DAYS[date.getDay()]) ?? null;
}

export function getTodayWorkout(now = new Date()) {
  return getWorkoutForDate(getDefaultWorkoutPlanDate(now));
}

export function getWorkoutDuration(workout) {
  if (!workout) return 0;

  const seconds =
    workout.exercises.reduce(
      (total, exercise) => total + exercise.duration + exercise.rest,
      0,
    ) * workout.rounds;

  return Math.ceil(seconds / 60);
}
