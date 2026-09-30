import { isValidDayKey } from "../../../shared/date.js";

export const WORKOUT_TRACKING_VERSION = 2;
export const DEFAULT_REST_SECONDS = 60;

const toTimestamp = (value) => {
  if (value === null || value === undefined || value === "") return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toNonNegativeNumber = (value, integer = false) => {
  if (value === "" || value === null || value === undefined) return null;

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  if (integer && !Number.isInteger(number)) return null;

  return number;
};

const slug = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "exercise";

export function getExerciseTrackingId(exercise, index) {
  if (typeof exercise?.id === "string" && exercise.id.trim()) {
    return `exercise:${exercise.id.trim()}`;
  }

  if (
    exercise?.id !== null &&
    exercise?.id !== undefined &&
    exercise.id !== "" &&
    Number.isFinite(Number(exercise.id))
  ) {
    return `exercise:${Number(exercise.id)}`;
  }

  return `exercise:${index + 1}:${slug(exercise?.name)}`;
}

const getPlannedSetCount = (exercise, workout) => {
  const exerciseSets = Number(exercise?.sets);
  const workoutRounds = Number(workout?.rounds);

  if (Number.isInteger(exerciseSets) && exerciseSets > 0) return exerciseSets;
  if (Number.isInteger(workoutRounds) && workoutRounds > 0) return workoutRounds;
  return 1;
};

const createSet = (exerciseId, number, isExtra = false) => ({
  id: `${exerciseId}:set:${number}`,
  reps: null,
  weight: null,
  completed: false,
  completedAt: null,
  isExtra,
});

const createExerciseTracking = (exercise, index, workout) => {
  const exerciseId = getExerciseTrackingId(exercise, index);
  const setCount = getPlannedSetCount(exercise, workout);

  return {
    exerciseId,
    name: exercise.name,
    notes: "",
    sets: Array.from({ length: setCount }, (_, setIndex) =>
      createSet(exerciseId, setIndex + 1),
    ),
  };
};

export function initializeWorkoutTracking(workout, startedAt = new Date()) {
  if (!Array.isArray(workout?.exercises) || workout.exercises.length === 0) {
    return null;
  }

  const timestamp = toTimestamp(startedAt);
  if (!timestamp) return null;

  return {
    version: WORKOUT_TRACKING_VERSION,
    startedAt: timestamp,
    exercises: workout.exercises.map((exercise, index) =>
      createExerciseTracking(exercise, index, workout),
    ),
  };
}

const normalizeSet = (set, fallbackId, isExtra = false) => {
  const reps = toNonNegativeNumber(set?.reps, true);
  const weight = toNonNegativeNumber(set?.weight);
  const completed = set?.completed === true && reps !== null;

  return {
    id:
      typeof set?.id === "string" && set.id.trim()
        ? set.id.trim()
        : fallbackId,
    reps,
    weight,
    completed,
    completedAt: completed ? toTimestamp(set?.completedAt) : null,
    isExtra: set?.isExtra === true || isExtra,
  };
};

const normalizeExerciseSets = (sourceSets, exerciseId, plannedCount) => {
  const sets = Array.isArray(sourceSets) ? sourceSets : [];
  const normalized = [];
  const usedIds = new Set();
  const targetCount =
    plannedCount === null ? sets.length : Math.max(plannedCount, sets.length);

  for (let index = 0; index < targetCount; index += 1) {
    const fallbackId = `${exerciseId}:set:${index + 1}`;
    const set = normalizeSet(
      sets[index],
      fallbackId,
      plannedCount !== null && index >= plannedCount,
    );
    let id = set.id;
    let suffix = index + 1;

    while (usedIds.has(id)) {
      suffix += 1;
      id = `${exerciseId}:set:${suffix}`;
    }

    usedIds.add(id);
    normalized.push({ ...set, id });
  }

  return normalized;
};

export function normalizeWorkoutTracking(tracking, workout, fallbackStartedAt) {
  if (tracking?.version !== WORKOUT_TRACKING_VERSION) return null;
  if (!Array.isArray(workout?.exercises) || workout.exercises.length === 0) {
    return null;
  }

  const startedAt =
    toTimestamp(tracking.startedAt) ?? toTimestamp(fallbackStartedAt);
  if (!startedAt) return null;

  const sourceExercises = Array.isArray(tracking.exercises)
    ? tracking.exercises
    : [];

  return {
    version: WORKOUT_TRACKING_VERSION,
    startedAt,
    exercises: workout.exercises.map((exercise, index) => {
      const exerciseId = getExerciseTrackingId(exercise, index);
      const matchingSource = sourceExercises.find(
        (item) => item?.exerciseId === exerciseId,
      );
      const positionalSource = sourceExercises[index];
      const source =
        matchingSource ??
        (typeof positionalSource?.exerciseId !== "string" ||
        !positionalSource.exerciseId.trim()
          ? positionalSource
          : null);
      const plannedCount = getPlannedSetCount(exercise, workout);

      return {
        exerciseId,
        name: exercise.name,
        notes: typeof source?.notes === "string" ? source.notes : "",
        sets: normalizeExerciseSets(source?.sets, exerciseId, plannedCount),
      };
    }),
  };
}

export function normalizeCompletedTracking(tracking) {
  if (
    tracking?.version !== WORKOUT_TRACKING_VERSION ||
    !Array.isArray(tracking.exercises)
  ) {
    return null;
  }

  const startedAt = toTimestamp(tracking.startedAt);
  if (!startedAt) return null;

  const seenExerciseIds = new Set();
  const exercises = [];

  tracking.exercises.forEach((exercise) => {
    if (
      typeof exercise?.exerciseId !== "string" ||
      !exercise.exerciseId.trim() ||
      typeof exercise?.name !== "string" ||
      !exercise.name.trim()
    ) {
      return;
    }

    const exerciseId = exercise.exerciseId.trim();
    if (seenExerciseIds.has(exerciseId)) return;
    seenExerciseIds.add(exerciseId);

    exercises.push({
      exerciseId,
      name: exercise.name,
      notes: typeof exercise.notes === "string" ? exercise.notes : "",
      sets: normalizeExerciseSets(exercise.sets, exerciseId, null),
    });
  });

  if (exercises.length === 0) return null;

  return {
    version: WORKOUT_TRACKING_VERSION,
    startedAt,
    exercises,
  };
}

const updateExercise = (tracking, exerciseId, update) => {
  if (tracking?.version !== WORKOUT_TRACKING_VERSION) return tracking;

  let changed = false;
  const exercises = tracking.exercises.map((exercise) => {
    if (exercise.exerciseId !== exerciseId) return exercise;

    const next = update(exercise);
    if (next !== exercise) changed = true;
    return next;
  });

  return changed ? { ...tracking, exercises } : tracking;
};

export function updateTrackingSetValue(
  tracking,
  exerciseId,
  setId,
  field,
  value,
) {
  if (field !== "reps" && field !== "weight") return tracking;

  const normalized = toNonNegativeNumber(value, field === "reps");
  if (value !== "" && value !== null && normalized === null) return tracking;

  return updateExercise(tracking, exerciseId, (exercise) => {
    let changed = false;
    const sets = exercise.sets.map((set) => {
      if (set.id !== setId || set.completed || set[field] === normalized) {
        return set;
      }

      changed = true;
      return { ...set, [field]: normalized };
    });

    return changed ? { ...exercise, sets } : exercise;
  });
}

export function completeTrackingSet(
  tracking,
  exerciseId,
  setId,
  completedAt = new Date(),
) {
  const timestamp = toTimestamp(completedAt);
  if (!timestamp) return tracking;

  return updateExercise(tracking, exerciseId, (exercise) => {
    let changed = false;
    const sets = exercise.sets.map((set) => {
      if (set.id !== setId || set.completed || set.reps === null) return set;

      changed = true;
      return { ...set, completed: true, completedAt: timestamp };
    });

    return changed ? { ...exercise, sets } : exercise;
  });
}

export function reopenTrackingSet(tracking, exerciseId, setId) {
  return updateExercise(tracking, exerciseId, (exercise) => {
    let changed = false;
    const sets = exercise.sets.map((set) => {
      if (set.id !== setId || !set.completed) return set;

      changed = true;
      return { ...set, completed: false, completedAt: null };
    });

    return changed ? { ...exercise, sets } : exercise;
  });
}

export function addTrackingSet(tracking, exerciseId) {
  return updateExercise(tracking, exerciseId, (exercise) => {
    const usedIds = new Set(exercise.sets.map((set) => set.id));
    let number = exercise.sets.length + 1;
    let id = `${exerciseId}:set:${number}`;

    while (usedIds.has(id)) {
      number += 1;
      id = `${exerciseId}:set:${number}`;
    }

    return {
      ...exercise,
      sets: [
        ...exercise.sets,
        { ...createSet(exerciseId, number, true), id },
      ],
    };
  });
}

export function removeTrackingSet(tracking, exerciseId, setId) {
  return updateExercise(tracking, exerciseId, (exercise) => {
    const target = exercise.sets.find((set) => set.id === setId);

    if (!target?.isExtra || target.completed || exercise.sets.length <= 1) {
      return exercise;
    }

    return {
      ...exercise,
      sets: exercise.sets.filter((set) => set.id !== setId),
    };
  });
}

export function updateTrackingNotes(tracking, exerciseId, notes) {
  if (typeof notes !== "string") return tracking;

  return updateExercise(tracking, exerciseId, (exercise) =>
    exercise.notes === notes ? exercise : { ...exercise, notes },
  );
}

export function deriveCurrentExerciseState(tracking, exerciseIndex) {
  const exercise = tracking?.exercises?.[exerciseIndex] ?? null;

  if (!exercise) {
    return { exercise: null, currentSet: null, allSetsComplete: false };
  }

  const currentSet = exercise.sets.find((set) => !set.completed) ?? null;

  return {
    exercise,
    currentSet,
    allSetsComplete: exercise.sets.length > 0 && currentSet === null,
  };
}

export function isWorkoutTrackingComplete(tracking) {
  return (
    tracking?.version === WORKOUT_TRACKING_VERSION &&
    Array.isArray(tracking.exercises) &&
    tracking.exercises.length > 0 &&
    tracking.exercises.every(
      (exercise) =>
        Array.isArray(exercise.sets) &&
        exercise.sets.length > 0 &&
        exercise.sets.every((set) => set.completed),
    )
  );
}

export function derivePreviousPerformance(sessions, exerciseId) {
  if (!Array.isArray(sessions) || typeof exerciseId !== "string") return null;

  const candidates = sessions
    .map((session) => ({
      date: session?.date,
      tracking: normalizeCompletedTracking(session?.tracking),
    }))
    .filter((session) => session.tracking && isValidDayKey(session.date))
    .sort((first, second) => {
      const dateOrder = second.date.localeCompare(first.date);
      if (dateOrder !== 0) return dateOrder;
      return second.tracking.startedAt.localeCompare(first.tracking.startedAt);
    });

  for (const session of candidates) {
    const exercise = session.tracking.exercises.find(
      (item) => item.exerciseId === exerciseId,
    );

    if (exercise) {
      const sets = exercise.sets.filter((set) => set.completed);
      if (sets.length === 0) continue;

      return {
        date: session.date,
        sets,
      };
    }
  }

  return null;
}

export function getTrackingMetrics(tracking) {
  const normalized = normalizeCompletedTracking(tracking);
  if (!normalized) return { totalSets: 0, totalReps: 0, totalVolume: 0 };

  const metrics = normalized.exercises.reduce(
    (totals, exercise) => {
      exercise.sets.forEach((set) => {
        if (!set.completed) return;

        totals.totalSets += 1;
        totals.totalReps += set.reps ?? 0;
        if (set.weight !== null) totals.totalVolume += set.weight * set.reps;
      });
      return totals;
    },
    { totalSets: 0, totalReps: 0, totalVolume: 0 },
  );

  return {
    ...metrics,
    totalVolume: Number(metrics.totalVolume.toFixed(2)),
  };
}
