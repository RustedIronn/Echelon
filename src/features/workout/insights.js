import { getLocalWeekRange, getToday } from "../../shared/date.js";
import { mergeWorkoutHistories } from "./workoutStorage.js";
import { normalizeCompletedTracking } from "./tracking.js";

const roundVolume = (value) => Number(value.toFixed(2));

const completedSets = (exercise) =>
  exercise.sets.filter(
    (set) =>
      set.completed &&
      Number.isFinite(set.reps) &&
      set.reps >= 0 &&
      (set.weight === null ||
        (Number.isFinite(set.weight) && set.weight >= 0)),
  );

const occurrenceOrder = (first, second) => {
  const dateOrder = second.date.localeCompare(first.date);
  if (dateOrder !== 0) return dateOrder;
  return second.startedAt.localeCompare(first.startedAt);
};

export function extractTrackedSessions(sessions) {
  return mergeWorkoutHistories(sessions, [])
    .map((session) => {
      const tracking = normalizeCompletedTracking(session.tracking);
      const hasCompletedSet = tracking?.exercises.some(
        (exercise) => completedSets(exercise).length > 0,
      );
      return tracking && hasCompletedSet ? { ...session, tracking } : null;
    })
    .filter(Boolean)
    .sort((first, second) => {
      const dateOrder = second.date.localeCompare(first.date);
      if (dateOrder !== 0) return dateOrder;
      return second.tracking.startedAt.localeCompare(
        first.tracking.startedAt,
      );
    });
}

const createOccurrence = (session, exercise) => {
  const sets = completedSets(exercise);
  const weightedSets = sets.filter((set) => set.weight !== null);

  return {
    sessionId: session.id ?? null,
    date: session.date,
    startedAt: session.tracking.startedAt,
    workout: session.workout,
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    notes: exercise.notes,
    sets,
    totalSets: sets.length,
    totalReps: sets.reduce((total, set) => total + set.reps, 0),
    weightedVolume: roundVolume(
      weightedSets.reduce(
        (total, set) => total + set.weight * set.reps,
        0,
      ),
    ),
    hasWeightedSets: weightedSets.length > 0,
  };
};

const getTrackingTotals = (tracking) => {
  const totals = { totalSets: 0, totalReps: 0, weightedVolume: 0 };

  tracking.exercises.forEach((exercise) => {
    completedSets(exercise).forEach((set) => {
      totals.totalSets += 1;
      totals.totalReps += set.reps;
      if (set.weight !== null) totals.weightedVolume += set.weight * set.reps;
    });
  });

  return totals;
};

const groupTrackedSessions = (trackedSessions) => {
  const groups = new Map();

  trackedSessions.forEach((session) => {
    session.tracking.exercises.forEach((exercise) => {
      const occurrence = createOccurrence(session, exercise);
      if (occurrence.sets.length === 0) return;

      const existing = groups.get(exercise.exerciseId);
      if (existing) {
        existing.occurrences.push(occurrence);
      } else {
        groups.set(exercise.exerciseId, {
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          occurrences: [occurrence],
        });
      }
    });
  });

  groups.forEach((group) => group.occurrences.sort(occurrenceOrder));
  return groups;
};

export function groupTrackedPerformanceByExercise(sessions) {
  return groupTrackedSessions(extractTrackedSessions(sessions));
}

export function getExercisePerformance(sessions, exerciseId) {
  if (typeof exerciseId !== "string" || !exerciseId) return null;
  return groupTrackedPerformanceByExercise(sessions).get(exerciseId) ?? null;
}

const achievementOrder = (first, second) => {
  const dateOrder = first.date.localeCompare(second.date);
  if (dateOrder !== 0) return dateOrder;

  const timeOrder = first.startedAt.localeCompare(second.startedAt);
  if (timeOrder !== 0) return timeOrder;
  return first.setIndex - second.setIndex;
};

const bestBy = (candidates, valueFor) =>
  candidates.reduce((best, candidate) => {
    const value = valueFor(candidate);
    if (!best || value > best.value) return { ...candidate, value };
    if (value < best.value) return best;
    return achievementOrder(candidate, best) < 0
      ? { ...candidate, value }
      : best;
  }, null);

export function computeExercisePRs(occurrences) {
  if (!Array.isArray(occurrences)) {
    return {
      heaviestWeight: null,
      mostReps: null,
      bestSetVolume: null,
      bestSessionVolume: null,
    };
  }

  const setCandidates = occurrences.flatMap((occurrence) =>
    occurrence.sets.map((set, setIndex) => ({
      date: occurrence.date,
      startedAt: occurrence.startedAt,
      sessionId: occurrence.sessionId,
      setIndex,
      reps: set.reps,
      weight: set.weight,
      setId: set.id,
    })),
  );
  const weightedSets = setCandidates.filter((set) => set.weight !== null);
  const weightedSessions = occurrences
    .filter((occurrence) => occurrence.hasWeightedSets)
    .map((occurrence) => ({ ...occurrence, setIndex: 0 }));

  return {
    heaviestWeight: bestBy(weightedSets, (set) => set.weight),
    mostReps: bestBy(setCandidates, (set) => set.reps),
    bestSetVolume: bestBy(weightedSets, (set) =>
      roundVolume(set.weight * set.reps),
    ),
    bestSessionVolume: bestBy(
      weightedSessions,
      (occurrence) => occurrence.weightedVolume,
    ),
  };
}

export function compareLatestExerciseSessions(occurrences) {
  if (!Array.isArray(occurrences) || occurrences.length < 2) return null;

  const [latest, previous] = [...occurrences].sort(occurrenceOrder);
  return {
    latest,
    previous,
    totalSetsDelta: latest.totalSets - previous.totalSets,
    totalRepsDelta: latest.totalReps - previous.totalReps,
    weightedVolumeDelta: roundVolume(
      latest.weightedVolume - previous.weightedVolume,
    ),
  };
}

export function getWeeklyTrackedAggregates(sessions) {
  const weeks = new Map();

  extractTrackedSessions(sessions).forEach((session) => {
    const week = getLocalWeekRange(session.date)?.start ?? null;
    if (!week) return;

    const current = weeks.get(week) ?? {
      week,
      workouts: 0,
      totalSets: 0,
      totalReps: 0,
      weightedVolume: 0,
    };
    const metrics = getTrackingTotals(session.tracking);

    current.totalSets += metrics.totalSets;
    current.totalReps += metrics.totalReps;
    current.weightedVolume += metrics.weightedVolume;
    current.workouts += 1;
    weeks.set(week, current);
  });

  return [...weeks.values()]
    .map((week) => ({
      ...week,
      weightedVolume: roundVolume(week.weightedVolume),
    }))
    .sort((first, second) => first.week.localeCompare(second.week));
}

export function getTrackedProgressSummary(sessions, now = new Date()) {
  const trackedSessions = extractTrackedSessions(sessions);
  const groups = groupTrackedSessions(trackedSessions);
  const today = getToday(now);
  const currentWeek = getLocalWeekRange(today)?.start ?? null;
  const currentMonth = today.slice(0, 7);
  const totals = {
    trackedSessions: trackedSessions.length,
    totalSets: 0,
    totalReps: 0,
    weightedVolume: 0,
    workoutsThisWeek: 0,
    workoutsThisMonth: 0,
  };

  trackedSessions.forEach((session) => {
    if (getLocalWeekRange(session.date)?.start === currentWeek) {
      totals.workoutsThisWeek += 1;
    }
    if (session.date.startsWith(currentMonth)) totals.workoutsThisMonth += 1;

    const metrics = getTrackingTotals(session.tracking);
    totals.totalSets += metrics.totalSets;
    totals.totalReps += metrics.totalReps;
    totals.weightedVolume += metrics.weightedVolume;
  });

  const mostTrained = [...groups.values()]
    .map((group) => ({
      exerciseId: group.exerciseId,
      name: group.name,
      sessions: group.occurrences.length,
    }))
    .sort(
      (first, second) =>
        second.sessions - first.sessions || first.name.localeCompare(second.name),
    );

  const recentImprovements = [...groups.values()]
    .map((group) => ({
      exerciseId: group.exerciseId,
      name: group.name,
      comparison: compareLatestExerciseSessions(group.occurrences),
    }))
    .filter(({ comparison }) => {
      if (!comparison) return false;
      const reps = comparison.totalRepsDelta;
      const volume = comparison.weightedVolumeDelta;
      return (reps > 0 && volume >= 0) || (volume > 0 && reps >= 0);
    })
    .sort((first, second) =>
      second.comparison.latest.date.localeCompare(
        first.comparison.latest.date,
      ),
    );

  return {
    ...totals,
    weightedVolume: roundVolume(totals.weightedVolume),
    mostTrained,
    recentImprovements,
  };
}
