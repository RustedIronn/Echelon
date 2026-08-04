import { getWorkouts } from "./workoutStorage";
import { getTodayWorkout } from "./workout";

export function getWorkoutStats() {
  const workouts = getWorkouts();

  const today = new Date().toISOString().split("T")[0];

  return {
    total: workouts.length,

    completedToday: workouts.some((workout) => workout.date === today),

    todayWorkout: getTodayWorkout(),
  };
}
