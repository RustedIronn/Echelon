import { saveData, loadData, removeData } from "../../shared/storage.js";
import {
  isWorkoutTrackingComplete,
  normalizeWorkoutTracking,
  WORKOUT_TRACKING_VERSION,
} from "./tracking.js";
import { isValidDayKey } from "../../shared/date.js";

const KEY = "echelon_workouts";
const PROGRESS_KEY = "echelon_workout_progress";

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

  const normalized = {
    workout,
    startedAt,
    elapsed,
    round,
    exerciseIndex,
    phase: progress.phase,
    seconds,
  };

  if (isValidDayKey(progress.planDate)) {
    normalized.planDate = progress.planDate;
  }

  const tracking = normalizeWorkoutTracking(
    progress.tracking,
    workout,
    startedAt,
  );

  if (
    progress.tracking !== null &&
    progress.tracking !== undefined &&
    (progress.tracking.version !== WORKOUT_TRACKING_VERSION || !tracking)
  ) {
    return null;
  }

  if (
    progress.phase === "finished" &&
    tracking &&
    !isWorkoutTrackingComplete(tracking)
  ) {
    return null;
  }

  return tracking ? { ...normalized, tracking } : normalized;
}

export function progressFields(state) {
  return normalizeWorkoutProgress({
    workout: state?.workout,
    startedAt: state?.startedAt,
    elapsed: state?.elapsed,
    round: state?.round,
    exerciseIndex: state?.exerciseIndex,
    phase: state?.phase,
    seconds: state?.seconds,
    planDate: state?.planDate,
    tracking: state?.tracking,
  });
}

export function saveWorkout(sessions) {
  const safeSessions = normalizeWorkoutHistory(sessions);

  return saveData(KEY, safeSessions) ? safeSessions : null;
}

export function getWorkouts() {
  return normalizeWorkoutHistory(loadData(KEY, []));
}

// Separate from saveWorkout/getWorkouts above — that's completed session
// history, this is a single in-progress session that hasn't been finished
// yet, so a closed tab or a "Stop Workout" doesn't lose your place.
export function saveProgress(progress) {
  const safeProgress = normalizeWorkoutProgress(progress);

  return safeProgress && saveData(PROGRESS_KEY, safeProgress)
    ? safeProgress
    : null;
}

export function getProgress() {
  return normalizeWorkoutProgress(loadData(PROGRESS_KEY, null));
}

export function clearProgress() {
  return removeData(PROGRESS_KEY);
}
