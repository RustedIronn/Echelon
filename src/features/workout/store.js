import { create } from "zustand";

import {
  loadWorkoutHistoryCloud,
  saveWorkoutHistoryCloud,
} from "./service";
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
import {
  advanceWorkoutRunner,
  completeRunnerExercise,
  pauseWorkoutRunner,
  restorePausedWorkoutRunner,
  resumeWorkoutRunner,
  runnerStateFields,
  skipRunnerRest,
  updateRunnerReflection,
  WORKOUT_RUNNER_VERSION,
} from "./runner";

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

  return saveProgress(progressFields({ ...state, tracking }))
    ? { tracking }
    : state;
};

const applyRunnerUpdate = (state, update, allowFinished = false) => {
  if ((!state.active && !(allowFinished && state.phase === "finished")) || state.runner?.version !== WORKOUT_RUNNER_VERSION) return state;
  const runner = update(state.runner, state.workout);
  if (!runner || runner === state.runner) return state;
  const next = { ...state, ...runnerStateFields(runner) };
  return saveProgress(progressFields(next)) ? next : state;
};

export const useWorkout = create((set, get) => ({
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
  runner: null,

  // A saved-but-not-active session, if one exists on load or after
  // stopWorkout. The Workouts page uses this to offer "Continue" instead of
  // "Start". Cleared once the workout finishes or is explicitly discarded.
  savedProgress,

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadWorkoutHistoryCloud(uid),
      async (sessions, uid) => {
        const merged = mergeWorkoutHistories(getWorkouts(), sessions);

        if (!saveWorkout(merged)) {
          throw new Error("Unable to persist reconciled Workout history.");
        }
        set({ sessions: merged });

        if (JSON.stringify(merged) !== JSON.stringify(sessions)) {
          await saveWorkoutHistoryCloud(uid, merged);
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
      return saveProgress(progressFields(next)) ? next : state;
    }),

  togglePause: () =>
    set((state) => {
      if (!state.active || !state.workout) return state;

      if (state.runner?.version === WORKOUT_RUNNER_VERSION) {
        return applyRunnerUpdate(state, (runner, workout) => runner.paused
          ? resumeWorkoutRunner(runner, workout)
          : pauseWorkoutRunner(runner, workout));
      }

      const paused = !state.paused;

      return saveProgress(progressFields({ ...state, paused }))
        ? { paused }
        : state;
    }),

  // Leaves the active session and returns to the Workouts page, but keeps
  // progress saved so continueWorkout can pick it back up later. This is
  // "pause and exit" — use reset() for a hard discard.
  stopWorkout: () =>
    set((state) => {
      if (!state.active || !state.workout) return state;

      if (state.runner?.version === WORKOUT_RUNNER_VERSION) {
        const runner = pauseWorkoutRunner(state.runner, state.workout);
        const next = { ...state, ...runnerStateFields(runner), active: false };
        const progress = progressFields(next);
        return progress && saveProgress(progress) ? { ...next, savedProgress: progress } : state;
      }

      const progress = progressFields(state);

      return saveProgress(progress)
        ? { active: false, savedProgress: progress }
        : state;
    }),

  // Rehydrates a previously saved session. Always resumes paused, even if it
  // wasn't paused when saved — silently continuing a countdown after the app
  // was closed for an unknown amount of time would be confusing, so the
  // user explicitly hits Resume once they're back and ready.
  continueWorkout: () => {
    const progress = normalizeWorkoutProgress(getProgress());

    if (!progress?.workout) return false;

    if (progress.runner?.version === WORKOUT_RUNNER_VERSION) {
      const runner = restorePausedWorkoutRunner(progress.runner, progress.workout);
      const restored = { ...progress, ...runnerStateFields(runner), active: true, paused: true };
      if (!saveProgress(progressFields(restored))) return false;
      set({ ...restored, startedAt: new Date(progress.startedAt) });
      return true;
    }

    set({
      ...progress,
      startedAt: progress.startedAt ? new Date(progress.startedAt) : null,
      active: true,
      paused: true,
    });
    return true;
  },

  completeExercise: (expectedKey) => {
    set((state) => {
      if (state.runner?.version === WORKOUT_RUNNER_VERSION) {
        return applyRunnerUpdate(state, (runner, workout) => completeRunnerExercise(runner, workout, new Date(), false, expectedKey));
      }
      const next = advanceExercise(state);

      if (next === state) return state;

      return saveProgress(progressFields(next)) ? next : state;
    });
  },

  skipRunnerExercise: (expectedKey) => {
    set((state) => applyRunnerUpdate(state, (runner, workout) => completeRunnerExercise(runner, workout, new Date(), true, expectedKey)));
  },
  skipRunnerRest: (expectedKey) => {
    set((state) => applyRunnerUpdate(state, (runner, workout) => skipRunnerRest(runner, workout, new Date(), expectedKey)));
  },
  setRunnerDifficulty: (difficulty) => set((state) => applyRunnerUpdate(state, (runner) => updateRunnerReflection(runner, { difficulty }), true)),
  setRunnerNote: (note) => set((state) => applyRunnerUpdate(state, (runner) => updateRunnerReflection(runner, { note }), true)),

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

      return saveProgress(progressFields(next)) ? next : state;
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

      return saveProgress(progressFields(next)) ? next : state;
    }),

  restartTrackedRest: () =>
    set((state) => {
      const next = restartTrackedRestState(state);
      if (next === state) return state;

      return saveProgress(progressFields(next)) ? next : state;
    }),

  continueTrackedWorkout: () =>
    set((state) => {
      const next = continueTrackedWorkoutState(state);
      if (next === state) return state;

      return saveProgress(progressFields(next)) ? next : state;
    }),

  // Completion is locally authoritative; the cloud write remains background
  // work and reports failures through the shared sync status.
  completeWorkout: () => {
    const state = useWorkout.getState();

    const completionDate = state.runner?.finishedAt ? getToday(new Date(state.runner.finishedAt)) : getToday();
    const completed = createCompletedSession(state, completionDate);

    if (!completed) return;

    const updated = mergeWorkoutHistories(state.sessions, [completed]);

    if (!saveWorkout(updated)) return false;
    if (!clearProgress()) return false;

    syncToCloud("workout", (uid) => saveWorkoutHistoryCloud(uid, updated));

    set({
      active: false,
      phase: "idle",
      seconds: 0,
      workout: null,
      planDate: null,
      sessions: updated,
      savedProgress: null,
      tracking: null,
      runner: null,
    });
    return true;
  },

  tick: () => {
    const current = get();
    if (current.active && current.runner?.version === WORKOUT_RUNNER_VERSION) {
      if (current.runner.paused) return false;
      const runner = advanceWorkoutRunner(current.runner, current.workout);
      const next = { ...current, ...runnerStateFields(runner) };
      if (!saveProgress(progressFields(next))) {
        const frozen = pauseWorkoutRunner(current.runner, current.workout);
        set({ ...runnerStateFields(frozen) });
        return false;
      }
      set(next);
      return true;
    }
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
      return saveProgress(progressFields({ ...state, ...next }))
        ? next
        : { paused: true };
    });
    return true;
  },

  reset: () => {
    if (!clearProgress()) return false;

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
      runner: null,
    });
    return true;
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
    runner: null,
  });
});
