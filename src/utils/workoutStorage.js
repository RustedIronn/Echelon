import { saveData, loadData } from "./storage";

const KEY = "echelon_workouts";

export function saveWorkout(sessions) {
  saveData(KEY, sessions);
  return sessions;
}

export function getWorkouts() {
  return loadData(KEY, []);
}
