import { saveData, loadData, removeData } from "../../shared/storage.js";

const KEY = "echelon_workouts";
const PROGRESS_KEY = "echelon_workout_progress";

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDayKey = (value) => {
  if (!DAY_KEY_PATTERN.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export function normalizeWorkoutHistory(sessions) {
  if (!Array.isArray(sessions)) return [];

  return sessions
    .filter((session) =>
      session &&
      typeof session.workout === "string" &&
      isValidDayKey(session.date) &&
      Number.isFinite(Number(session.duration)) &&
      Number(session.duration) >= 0,
    )
    .map((session) => ({
      ...session,
      duration: Number(session.duration),
    }));
}

const historyKey = (session) =>
  session.id || JSON.stringify([
    session.workout,
    session.date,
    session.duration,
  ]);

export function mergeWorkoutHistories(localSessions, cloudSessions) {
  const local = normalizeWorkoutHistory(localSessions);
  const cloud = normalizeWorkoutHistory(cloudSessions);
  const seen = new Set();
  const merged = [];

  for (const session of [...local, ...cloud]) {
    const key = historyKey(session);

    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(session);
  }

  return merged;
}

export function normalizeWorkoutProgress(progress) {
  const workout = progress?.workout;
  const exercises = workout?.exercises;
  const rounds = Number(workout?.rounds);
  const round = Number(progress?.round);
  const exerciseIndex = Number(progress?.exerciseIndex);
  const elapsed = Number(progress?.elapsed);
  const seconds = Number(progress?.seconds);
  const validPhases = new Set(["prepare", "exercise", "rest", "finished"]);
  const startedAt = progress?.startedAt;
  const validStartedAt =
    startedAt instanceof Date
      ? !Number.isNaN(startedAt.getTime())
      : typeof startedAt === "string" && !Number.isNaN(Date.parse(startedAt));

  if (
    !workout ||
    typeof workout.title !== "string" ||
    !Array.isArray(exercises) ||
    exercises.length === 0 ||
    exercises.some((exercise) =>
      !exercise ||
      typeof exercise.name !== "string" ||
      !Number.isFinite(Number(exercise.duration)) ||
      Number(exercise.duration) < 0 ||
      !Number.isFinite(Number(exercise.rest)) ||
      Number(exercise.rest) < 0,
    ) ||
    !Number.isInteger(rounds) ||
    rounds < 1 ||
    !Number.isInteger(round) ||
    round < 1 ||
    round > rounds ||
    !Number.isInteger(exerciseIndex) ||
    exerciseIndex < 0 ||
    exerciseIndex >= exercises.length ||
    !validPhases.has(progress?.phase) ||
    !validStartedAt ||
    !Number.isFinite(elapsed) ||
    elapsed < 0 ||
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return null;
  }

  return {
    workout,
    startedAt,
    elapsed,
    round,
    exerciseIndex,
    phase: progress.phase,
    seconds,
  };
}

export function saveWorkout(sessions) {
  const safeSessions = normalizeWorkoutHistory(sessions);

  saveData(KEY, safeSessions);
  return safeSessions;
}

export function getWorkouts() {
  return normalizeWorkoutHistory(loadData(KEY, []));
}

// Separate from saveWorkout/getWorkouts above — that's completed session
// history, this is a single in-progress session that hasn't been finished
// yet, so a closed tab or a "Stop Workout" doesn't lose your place.
export function saveProgress(progress) {
  const safeProgress = normalizeWorkoutProgress(progress);

  if (safeProgress) saveData(PROGRESS_KEY, safeProgress);
}

export function getProgress() {
  return normalizeWorkoutProgress(loadData(PROGRESS_KEY, null));
}

export function clearProgress() {
  removeData(PROGRESS_KEY);
}
