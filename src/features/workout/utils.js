import { workouts } from "./constants";

export function getTodayWorkout() {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const today = days[new Date().getDay()];

  return workouts.find((workout) => workout.day === today);
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
