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
} from "./workoutStorage";
import { getToday } from "@/shared/date";
import { syncToCloud, loadFromCloud } from "@core/cloudSync";
import { advanceExercise, createCompletedSession } from "./state";

// The fields that make up a resumable in-progress session. Persisted after
// every meaningful change (tick, pause, exercise complete, stop) so a closed
// tab, a "Stop Workout", or an accidental refresh doesn't lose progress.
// Kept separate from `sessions`, which is completed-workout history.
const progressFields = (state) => ({
  workout: state.workout,
  startedAt: state.startedAt,
  elapsed: state.elapsed,
  round: state.round,
  exerciseIndex: state.exerciseIndex,
  phase: state.phase,
  seconds: state.seconds,
});

const savedProgress = getProgress();

export const useWorkout = create((set) => ({
  active: false,
  paused: false,
  workout: null,
  startedAt: null,
  elapsed: 0,
  sessions: getWorkouts(),
  round: 0,
  exerciseIndex: 0,
  phase: "idle",
  seconds: 0,

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

  startWorkout: (workout) => {
    if (
      !workout ||
      !Array.isArray(workout.exercises) ||
      workout.exercises.length === 0 ||
      !Number.isInteger(workout.rounds) ||
      workout.rounds < 1
    ) {
      return;
    }

    const next = {
      active: true,
      paused: false,
      workout,
      startedAt: new Date(),
      elapsed: 0,
      round: 1,
      exerciseIndex: 0,
      phase: "prepare",
      seconds: 5,
    };

    set(next);
    saveProgress(progressFields(next));
  },

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
      sessions: updated,
      savedProgress: null,
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
      startedAt: null,
      elapsed: 0,
      round: 0,
      exerciseIndex: 0,
      phase: "idle",
      seconds: 0,
      savedProgress: null,
    });
  },
}));
