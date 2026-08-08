import { create } from "zustand";

import { saveWorkoutCloud, loadWorkoutCloud } from "./service";
import { saveWorkout, getWorkouts } from "./workoutStorage";
import { getToday } from "@utils/date";
import { syncToCloud, loadFromCloud } from "@utils/cloudSync";

export const useWorkout = create((set) => ({
  active: false,
  paused: false,
  workout: null,
  startedAt: null,
  elapsed: 0,

  // was `sessions: []` — never read local storage on init, so a full
  // page reload silently dropped whatever completeWorkout had saved.
  sessions: getWorkouts(),

  round: 0,
  exerciseIndex: 0,
  phase: "idle",
  seconds: 0,

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadWorkoutCloud(uid),
      (sessions) => {
        set({ sessions });
        saveWorkout(sessions);
      },
    ),

  startWorkout: (workout) => {
    set({
      active: true,
      paused: false,
      workout,
      startedAt: new Date(),
      elapsed: 0,
      round: 1,
      exerciseIndex: 0,
      phase: "prepare",
      seconds: 5,
    });
  },

  togglePause: () => {
    set((state) => ({
      paused: !state.paused,
    }));
  },

  completeExercise: () =>
    set((state) => {
      const nextExercise = state.exerciseIndex + 1;

      if (nextExercise < state.workout.exercises.length) {
        return {
          exerciseIndex: nextExercise,
          phase: "prepare",
          seconds: 5,
        };
      }

      if (state.round < state.workout.rounds) {
        return {
          round: state.round + 1,
          exerciseIndex: 0,
          phase: "prepare",
          seconds: 5,
        };
      }

      return {
        active: false,
        phase: "finished",
        seconds: 0,
      };
    }),

  // was `async`, and `await saveWorkoutCloud(...)` — completeWorkout no longer
  // waits on the network, matching how every other store's cloud sync behaves
  // (fire-and-forget via syncToCloud). If a caller was relying on awaiting
  // this to know the cloud write finished, that behavior has changed.
  completeWorkout: () => {
    const state = useWorkout.getState();

    if (!state.workout) return;

    const completed = {
      workout: state.workout.title,
      date: getToday(),
      duration: state.elapsed,
    };

    // previously: saveWorkout(updated) appended `updated` (the whole new
    // sessions array) as a single element onto whatever was already in
    // localStorage, nesting the array deeper every completed workout.
    const updated = [...state.sessions, completed];

    saveWorkout(updated);
    syncToCloud((uid) => saveWorkoutCloud(uid, updated));

    set({
      active: false,
      phase: "idle",
      seconds: 0,
      workout: null,
      sessions: updated,
    });
  },

  tick: () =>
    set((state) => {
      if (!state.active || state.paused) return state;

      if (state.seconds > 0) {
        return {
          seconds: state.seconds - 1,
          elapsed: state.elapsed + 1,
        };
      }

      const exercise = state.workout.exercises[state.exerciseIndex];

      if (state.phase === "prepare") {
        return {
          phase: "exercise",
          seconds: exercise.duration,
        };
      }

      if (state.phase === "exercise") {
        return {
          phase: "rest",
          seconds: exercise.rest,
        };
      }

      if (state.phase === "rest") {
        const nextExercise = state.exerciseIndex + 1;

        if (nextExercise < state.workout.exercises.length) {
          return {
            exerciseIndex: nextExercise,
            phase: "prepare",
            seconds: 5,
          };
        }

        if (state.round < state.workout.rounds) {
          return {
            round: state.round + 1,
            exerciseIndex: 0,
            phase: "prepare",
            seconds: 5,
          };
        }

        return {
          active: false,
          phase: "finished",
          seconds: 0,
        };
      }

      return state;
    }),

  reset: () => {
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
    });
  },
}));
