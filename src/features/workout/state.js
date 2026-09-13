export function advanceExercise(state) {
  if (
    !state?.active ||
    state.paused ||
    state.phase !== "exercise" ||
    !state.workout?.exercises?.length
  ) {
    return state;
  }

  const nextExercise = state.exerciseIndex + 1;

  if (nextExercise < state.workout.exercises.length) {
    return { ...state, exerciseIndex: nextExercise, phase: "prepare", seconds: 5 };
  }

  if (state.round < state.workout.rounds) {
    return {
      ...state,
      round: state.round + 1,
      exerciseIndex: 0,
      phase: "prepare",
      seconds: 5,
    };
  }

  return { ...state, active: false, phase: "finished", seconds: 0 };
}

export function createCompletedSession(state, date) {
  if (!state?.workout || state.phase !== "finished") return null;

  return {
    id: [
      state.startedAt instanceof Date
        ? state.startedAt.toISOString()
        : state.startedAt,
      state.workout.title,
    ].join("|"),
    workout: state.workout.title,
    date,
    duration: state.elapsed,
  };
}
