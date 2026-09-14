import { create } from "zustand";

import { saveWorkoutCloud, loadWorkoutCloud } from "./service";
import {
  saveWorkout,
  getWorkouts,
  saveProgress,
  getProgress,
  clearProgress,
  mergeWorkoutHistories,
  normalizeWorkoutProgress,
  progressFields,
} from "./workoutStorage";
import { getToday } from "@/shared/date";
import { syncToCloud, loadFromCloud } from "@core/cloudSync";
import {
  advanceExercise,
  completeTrackedSetState,
  continueTrackedWorkoutState,
  createWorkoutStartState,
  createCompletedSession,
  restartTrackedRestState,
  skipTrackedRestState,
} from "./state";
import {
  addTrackingSet,
  removeTrackingSet,
  reopenTrackingSet,
  updateTrackingNotes,
  updateTrackingSetValue,
  WORKOUT_TRACKING_VERSION,
} from "./tracking";
import { subscribeStorageOwner } from "@/shared/storage";

const savedProgress = getProgress();

const applyTrackingUpdate = (state, update) => {
  if (
    !state.active ||
    state.paused ||
    state.tracking?.version !== WORKOUT_TRACKING_VERSION
  ) {
    return state;
  }

  const tracking = update(state.tracking);
  if (tracking === state.tracking) return state;

  saveProgress(progressFields({ ...state, tracking }));
  return { tracking };
};

export const useWorkout = create((set) => ({
  active: false,
  paused: false,
  workout: null,
  planDate: null,
  startedAt: null,
  elapsed: 0,
  sessions: getWorkouts(),
  round: 0,
  exerciseIndex: 0,
  phase: "idle",
  seconds: 0,
  tracking: null,

  // A saved-but-not-active session, if one exists on load or after
  // stopWorkout. The Workouts page uses this to offer "Continue" instead of
  // "Start". Cleared once the workout finishes or is explicitly discarded.
  savedProgress,

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadWorkoutCloud(uid),
      async (sessions, uid) => {
        const merged = mergeWorkoutHistories(getWorkouts(), sessions);

        set({ sessions: merged });
        saveWorkout(merged);

        if (JSON.stringify(merged) !== JSON.stringify(sessions)) {
          await saveWorkoutCloud(uid, merged);
        }
      },
    ),

  startWorkout: (workout, planDate) =>
    set((state) => {
      const next = createWorkoutStartState(
        state,
        workout,
        planDate,
        new Date(),
      );

      if (next === state) return state;
      saveProgress(progressFields(next));
      return next;
    }),

  togglePause: () =>
    set((state) => {
      if (!state.active || !state.workout) return state;

      const paused = !state.paused;

      saveProgress(progressFields({ ...state, paused }));

      return { paused };
    }),

  // Leaves the active session and returns to the Workouts page, but keeps
  // progress saved so continueWorkout can pick it back up later. This is
  // "pause and exit" — use reset() for a hard discard.
  stopWorkout: () =>
    set((state) => {
      if (!state.active || !state.workout) return state;

      const progress = progressFields(state);

      saveProgress(progress);

      return { active: false, savedProgress: progress };
    }),

  // Rehydrates a previously saved session. Always resumes paused, even if it
  // wasn't paused when saved — silently continuing a countdown after the app
  // was closed for an unknown amount of time would be confusing, so the
  // user explicitly hits Resume once they're back and ready.
  continueWorkout: () => {
    const progress = normalizeWorkoutProgress(getProgress());

    if (!progress?.workout) return;

    set({
      ...progress,
      startedAt: progress.startedAt ? new Date(progress.startedAt) : null,
      active: true,
      paused: true,
    });
  },

  completeExercise: () =>
    set((state) => {
      const next = advanceExercise(state);

      if (next === state) return state;

      saveProgress(progressFields(next));

      return next;
    }),

  updateTrackedSet: (exerciseId, setId, field, value) =>
    set((state) =>
      applyTrackingUpdate(state, (tracking) =>
        updateTrackingSetValue(tracking, exerciseId, setId, field, value),
      ),
    ),

  completeTrackedSet: (exerciseId, setId) =>
    set((state) => {
      const next = completeTrackedSetState(state, exerciseId, setId);

      if (next === state) return state;

      saveProgress(progressFields(next));
      return next;
    }),

  reopenTrackedSet: (exerciseId, setId) =>
    set((state) =>
      applyTrackingUpdate(state, (tracking) =>
        reopenTrackingSet(tracking, exerciseId, setId),
      ),
    ),

  addTrackedSet: (exerciseId) =>
    set((state) =>
      applyTrackingUpdate(state, (tracking) =>
        addTrackingSet(tracking, exerciseId),
      ),
    ),

  removeTrackedSet: (exerciseId, setId) =>
    set((state) =>
      applyTrackingUpdate(state, (tracking) =>
        removeTrackingSet(tracking, exerciseId, setId),
      ),
    ),

  updateTrackedNotes: (exerciseId, notes) =>
    set((state) =>
      applyTrackingUpdate(state, (tracking) =>
        updateTrackingNotes(tracking, exerciseId, notes),
      ),
    ),

  skipTrackedRest: () =>
    set((state) => {
      const next = skipTrackedRestState(state);
      if (next === state) return state;

      saveProgress(progressFields(next));
      return next;
    }),

  restartTrackedRest: () =>
    set((state) => {
      const next = restartTrackedRestState(state);
      if (next === state) return state;

      saveProgress(progressFields(next));
      return next;
    }),

  continueTrackedWorkout: () =>
    set((state) => {
      const next = continueTrackedWorkoutState(state);
      if (next === state) return state;

      saveProgress(progressFields(next));
      return next;
    }),

  // was `async`, and `await saveWorkoutCloud(...)` — completeWorkout no longer
  // waits on the network, matching how every other store's cloud sync behaves
  // (fire-and-forget via syncToCloud). If a caller was relying on awaiting
  // this to know the cloud write finished, that behavior has changed.
  completeWorkout: () => {
    const state = useWorkout.getState();

    const completed = createCompletedSession(state, getToday());

    if (!completed) return;

    const updated = mergeWorkoutHistories(state.sessions, [completed]);

    saveWorkout(updated);
    syncToCloud((uid) => saveWorkoutCloud(uid, updated));
    clearProgress();

    set({
      active: false,
      phase: "idle",
      seconds: 0,
      workout: null,
      planDate: null,
      sessions: updated,
      savedProgress: null,
      tracking: null,
    });
  },

  tick: () =>
    set((state) => {
      if (
        !state.active ||
        state.paused ||
        !state.workout?.exercises?.[state.exerciseIndex]
      ) {
        return state;
      }

      let next;

      if (state.seconds > 0) {
        next = { seconds: state.seconds - 1, elapsed: state.elapsed + 1 };
      } else if (
        state.tracking?.version === WORKOUT_TRACKING_VERSION &&
        (state.phase === "exercise" || state.phase === "rest")
      ) {
        return state;
      } else {
        const exercise = state.workout.exercises[state.exerciseIndex];

        if (state.phase === "prepare") {
          next = { phase: "exercise", seconds: exercise.duration };
        } else if (state.phase === "exercise") {
          next = { phase: "rest", seconds: exercise.rest };
        } else if (state.phase === "rest") {
          const nextExercise = state.exerciseIndex + 1;

          if (nextExercise < state.workout.exercises.length) {
            next = {
              exerciseIndex: nextExercise,
              phase: "prepare",
              seconds: 5,
            };
          } else if (state.round < state.workout.rounds) {
            next = {
              round: state.round + 1,
              exerciseIndex: 0,
              phase: "prepare",
              seconds: 5,
            };
          } else {
            next = { active: false, phase: "finished", seconds: 0 };
          }
        } else {
          next = state;
        }
      }

      // persisted every tick — worst case on a crash you lose ~1 second
      saveProgress(progressFields({ ...state, ...next }));

      return next;
    }),

  reset: () => {
    clearProgress();

    set({
      active: false,
      paused: false,
      workout: null,
      planDate: null,
      startedAt: null,
      elapsed: 0,
      round: 0,
      exerciseIndex: 0,
      phase: "idle",
      seconds: 0,
      savedProgress: null,
      tracking: null,
    });
  },
}));

subscribeStorageOwner(() => {
  useWorkout.setState({
    active: false,
    paused: false,
    workout: null,
    planDate: null,
    startedAt: null,
    elapsed: 0,
    sessions: getWorkouts(),
    round: 0,
    exerciseIndex: 0,
    phase: "idle",
    seconds: 0,
    savedProgress: getProgress(),
    tracking: null,
  });
});
