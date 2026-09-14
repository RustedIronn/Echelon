import {
  completeTrackingSet,
  deriveCurrentExerciseState,
  isWorkoutTrackingComplete,
  normalizeWorkoutTracking,
  WORKOUT_TRACKING_VERSION,
  DEFAULT_REST_SECONDS,
} from "./tracking.js";

export function advanceExercise(state) {
  if (
    !state?.active ||
    state.paused ||
    state.phase !== "exercise" ||
    state.tracking?.version === WORKOUT_TRACKING_VERSION ||
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

const getRestDuration = (state) => {
  const rest = Number(state?.workout?.exercises?.[state.exerciseIndex]?.rest);
  return Number.isFinite(rest) && rest >= 0 ? rest : DEFAULT_REST_SECONDS;
};

export function completeTrackedSetState(
  state,
  exerciseId,
  setId,
  completedAt = new Date(),
) {
  if (
    !state?.active ||
    state.paused ||
    state.phase !== "exercise" ||
    state.tracking?.version !== WORKOUT_TRACKING_VERSION
  ) {
    return state;
  }

  const current = deriveCurrentExerciseState(
    state.tracking,
    state.exerciseIndex,
  );

  if (
    current.exercise?.exerciseId !== exerciseId ||
    current.currentSet?.id !== setId ||
    current.currentSet.reps === null
  ) {
    return state;
  }

  const tracking = completeTrackingSet(
    state.tracking,
    exerciseId,
    setId,
    completedAt,
  );

  if (tracking === state.tracking) return state;

  return {
    ...state,
    tracking,
    phase: "rest",
    seconds: getRestDuration(state),
  };
}

export function skipTrackedRestState(state) {
  if (
    !state?.active ||
    state.paused ||
    state.phase !== "rest" ||
    state.tracking?.version !== WORKOUT_TRACKING_VERSION ||
    state.seconds === 0
  ) {
    return state;
  }

  return { ...state, seconds: 0 };
}

export function restartTrackedRestState(state) {
  if (
    !state?.active ||
    state.paused ||
    state.phase !== "rest" ||
    state.tracking?.version !== WORKOUT_TRACKING_VERSION
  ) {
    return state;
  }

  const seconds = getRestDuration(state);
  return state.seconds === seconds ? state : { ...state, seconds };
}

export function continueTrackedWorkoutState(state) {
  if (
    !state?.active ||
    state.paused ||
    state.phase !== "rest" ||
    state.seconds !== 0 ||
    state.tracking?.version !== WORKOUT_TRACKING_VERSION
  ) {
    return state;
  }

  const current = deriveCurrentExerciseState(
    state.tracking,
    state.exerciseIndex,
  );

  if (!current.exercise) return state;

  if (!current.allSetsComplete) {
    const duration = Number(
      state.workout?.exercises?.[state.exerciseIndex]?.duration,
    );

    return {
      ...state,
      phase: "exercise",
      seconds: Number.isFinite(duration) && duration >= 0 ? duration : 0,
    };
  }

  const nextExercise = state.tracking.exercises.findIndex(
    (exercise, index) =>
      index > state.exerciseIndex &&
      exercise.sets.some((set) => !set.completed),
  );

  if (nextExercise !== -1) {
    return {
      ...state,
      exerciseIndex: nextExercise,
      phase: "prepare",
      seconds: 5,
    };
  }

  const earlierIncompleteExercise = state.tracking.exercises.findIndex(
    (exercise) => exercise.sets.some((set) => !set.completed),
  );

  if (earlierIncompleteExercise !== -1) {
    return {
      ...state,
      exerciseIndex: earlierIncompleteExercise,
      phase: "prepare",
      seconds: 5,
    };
  }

  return { ...state, active: false, phase: "finished", seconds: 0 };
}

export function createCompletedSession(state, date) {
  if (!state?.workout || state.phase !== "finished") return null;

  const completed = {
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

  const tracking = normalizeWorkoutTracking(
    state.tracking,
    state.workout,
    state.startedAt,
  );

  if (
    state.tracking !== null &&
    state.tracking !== undefined &&
    (!tracking || !isWorkoutTrackingComplete(tracking))
  ) {
    return null;
  }

  return tracking ? { ...completed, tracking } : completed;
}
