import { getToday, isValidDayKey } from "../../../shared/date.js";

const validWorkouts = (workouts) =>
  Array.isArray(workouts)
    ? workouts.filter((item) =>
        item &&
        typeof item.workout === "string" &&
        isValidDayKey(item.date) &&
        Number.isFinite(Number(item.duration)) &&
        Number(item.duration) >= 0,
      )
    : [];

const dayNumber = (dayKey) => {
  const [year, month, day] = dayKey.split("-").map(Number);

  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
};

export function getWorkoutStats(workouts = []) {
  const safeWorkouts = validWorkouts(workouts);
  const totalWorkouts = safeWorkouts.length;

  const totalSeconds = safeWorkouts.reduce(
    (total, item) => total + Number(item.duration),
    0,
  );

  const workoutCount = {};

  safeWorkouts.forEach((item) => {
    workoutCount[item.workout] = (workoutCount[item.workout] || 0) + 1;
  });

  const mostTrained = Object.entries(workoutCount).sort(
    (a, b) => b[1] - a[1],
  )[0];

  const today = getToday();

  const todayWorkout = safeWorkouts.find((item) => item.date === today);

  return {
    totalWorkouts,

    totalMinutes: Math.floor(totalSeconds / 60),

    mostTrained: mostTrained ? mostTrained[0] : "None",

    completedToday: !!todayWorkout,

    todayWorkout,
  };
}

export function getWorkoutStreak(workouts = []) {
  const safeWorkouts = validWorkouts(workouts);

  if (safeWorkouts.length === 0) return 0;

  const dates = [...new Set(safeWorkouts
    .map((item) => item.date)
  )].sort().reverse();

  let streak = 0;

  let expected = dayNumber(getToday());
  const newest = dayNumber(dates[0]);

  if (expected - newest > 1) return 0;
  if (expected - newest === 1) expected = newest;

  for (const date of dates) {
    const workoutDay = dayNumber(date);

    if (workoutDay === expected) {
      streak++;
      expected--;
    } else {
      break;
    }
  }

  return streak;
}
