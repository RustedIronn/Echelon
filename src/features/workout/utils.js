import { workouts } from "./constants.js";
import { getToday, parseDayKey } from "../../shared/date.js";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function getDefaultWorkoutPlanDate(now = new Date()) {
  return getToday(now);
}

export function shiftWorkoutPlanDate(dayKey, offset) {
  const date = parseDayKey(dayKey);
  if (!date || !Number.isInteger(offset)) return null;

  date.setDate(date.getDate() + offset);
  return getToday(date);
}

export function getWorkoutForDate(dayKey) {
  const date = parseDayKey(dayKey);
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
