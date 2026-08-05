import { saveData, loadData } from "./storage";

const KEY = "echelon_workouts";

export function saveWorkout(workout) {
  const workouts = loadData(KEY, []);

  const updated = [...workouts, workout];

  saveData(KEY, updated);

  return updated;
}

export function getWorkouts() {
  return loadData(KEY, []);
}
