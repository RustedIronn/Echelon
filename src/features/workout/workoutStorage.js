import { saveData, loadData } from "@utils/storage";

const KEY = "echelon_workouts";
const PROGRESS_KEY = "echelon_workout_progress";

export function saveWorkout(sessions) {
  saveData(KEY, sessions);
  return sessions;
}

export function getWorkouts() {
  return loadData(KEY, []);
}

// Separate from saveWorkout/getWorkouts above — that's completed session
// history, this is a single in-progress session that hasn't been finished
// yet, so a closed tab or a "Stop Workout" doesn't lose your place.
export function saveProgress(progress) {
  saveData(PROGRESS_KEY, progress);
}

export function getProgress() {
  return loadData(PROGRESS_KEY, null);
}

export function clearProgress() {
  saveData(PROGRESS_KEY, null);
}
