import { create } from "zustand";

import { saveWorkoutCloud, loadWorkoutCloud } from "@services/workout";

import { useAuth } from "@store/useAuth";

import { saveWorkout } from "@utils/workoutStorage";
import { getToday } from "@utils/date";

export const useWorkout = create((set) => ({
  active: false,

  paused: false,

  workout: null,

  startedAt: null,

  elapsed: 0,

  sessions: [],

  round: 0,

  exerciseIndex: 0,

  phase: "idle",

  seconds: 0,

  loadFromCloud: async () => {
    const user = useAuth.getState().user;

    if (!user) return;

    const sessions = await loadWorkoutCloud(user.uid);

    set({
      sessions,
    });
  },

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

  completeWorkout: async () => {
    const state = useWorkout.getState();

    if (!state.workout) return;

    const completed = {
      workout: state.workout.title,

      date: getToday(),

      duration: state.elapsed,
    };

    const updated = [...state.sessions, completed];

    saveWorkout(updated);

    set({
      active: false,
      phase: "idle",
      seconds: 0,
      workout: null,
      sessions: updated,
    });

    const user = useAuth.getState().user;

    if (user) {
      await saveWorkoutCloud(user.uid, updated);
    }
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
