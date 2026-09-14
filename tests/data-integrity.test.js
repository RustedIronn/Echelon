import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  calculateExecutionScore,
  weightedScore,
} from "../src/shared/executionScore.js";
import { getToday, isNewDay } from "../src/shared/date.js";
import {
  getMillisecondsUntilNextLocalDay,
  hasLocalDayChanged,
} from "../src/shared/dayRollover.js";
import {
  getUserStorageKey,
  loadData,
  migrateStorage,
  saveData,
  setStorageOwner,
} from "../src/shared/storage.js";
import {
  reconcileVersionedState,
  resolveVersionedState,
} from "../src/shared/versionedState.js";
import {
  getWorkoutStats,
  getWorkoutStreak,
} from "../src/features/workout/analyzer.js";
import {
  mergeWorkoutHistories,
  normalizeWorkoutHistory,
  normalizeWorkoutProgress,
  progressFields,
} from "../src/features/workout/workoutStorage.js";
import {
  advanceExercise,
  completeTrackedSetState,
  continueTrackedWorkoutState,
  createCompletedSession,
  createWorkoutStartState,
  restartTrackedRestState,
  skipTrackedRestState,
} from "../src/features/workout/state.js";
import {
  addTrackingSet,
  completeTrackingSet,
  deriveCurrentExerciseState,
  derivePreviousPerformance,
  getTrackingMetrics,
  initializeWorkoutTracking,
  normalizeWorkoutTracking,
  removeTrackingSet,
  reopenTrackingSet,
  updateTrackingNotes,
  updateTrackingSetValue,
} from "../src/features/workout/tracking.js";
import {
  getAdjacentWorkoutDates,
  getCalendarMonth,
  groupWorkoutHistoryByDate,
  shiftCalendarMonth,
  sortWorkoutHistory,
} from "../src/features/workout/history.js";
import {
  getDefaultWorkoutPlanDate,
  getWorkoutForDate,
  shiftWorkoutPlanDate,
} from "../src/features/workout/utils.js";
import {
  compareLatestExerciseSessions,
  computeExercisePRs,
  extractTrackedSessions,
  getExercisePerformance,
  getTrackedProgressSummary,
  getWeekStartDayKey,
  getWeeklyTrackedAggregates,
  groupTrackedPerformanceByExercise,
} from "../src/features/workout/insights.js";
import {
  getTodayFocusTime,
  mergeFocusSessions,
} from "../src/features/focus/utils.js";
import { generateReview } from "../src/features/review/analyzer.js";
import { computeReviewBreakdown } from "../src/features/review/breakdown.js";
import { mergeReviews } from "../src/features/review/reviewStorage.js";
import {
  normalizeDailyTasks,
  normalizeSchedule,
  schedule as defaultSchedule,
} from "../src/features/schedule/constants.js";
import {
  generateWeeklyInsights,
  normalizeProgressHistory,
} from "../src/features/analytics/insights.js";
import {
  calculateReminderTime,
  createReminderId,
  createScheduleReminder,
  deriveScheduleReminders,
  isWithinQuietHours,
  planReminders,
} from "../src/features/notifications/utils.js";
import { createReminderScheduler } from "../src/features/notifications/scheduler.js";
import {
  canUseBrowserNotifications,
  getNotificationPermission,
  requestNotificationPermission,
} from "../src/features/notifications/permissions.js";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  REMINDER_GRACE_MS,
} from "../src/features/notifications/constants.js";

const memory = new Map();

globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};

const localDay = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return getToday(date);
};

test("local storage falls back safely when JSON is malformed", () => {
  memory.clear();
  memory.set("broken", "{not-json");
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    assert.deepEqual(loadData("broken", []), []);
    assert.equal(memory.get("broken"), "{not-json");
  } finally {
    console.warn = originalWarn;
  }

  saveData("valid", { value: 1 });
  assert.deepEqual(loadData("valid", null), { value: 1 });
});

test("legacy user data is claimed once by the first authenticated UID", () => {
  memory.clear();
  setStorageOwner(null);
  const legacy = { date: localDay(), data: [{ name: "Read", done: true }] };
  memory.set("lockin_habits", JSON.stringify(legacy));

  setStorageOwner("user-a");

  assert.deepEqual(loadData("echelon_habits", null), legacy);
  assert.equal(
    memory.get(getUserStorageKey("user-a", "echelon_habits")),
    JSON.stringify(legacy),
  );
});

test("same-user reload reads the same scoped cache", () => {
  memory.clear();
  setStorageOwner(null);
  setStorageOwner("user-a");
  saveData("echelon_today", { owner: "A" });

  setStorageOwner(null);
  assert.deepEqual(loadData("echelon_today", null), null);
  setStorageOwner("user-a");

  assert.deepEqual(loadData("echelon_today", null), { owner: "A" });
});

test("notification settings use the existing UID-scoped storage boundary", () => {
  memory.clear();
  setStorageOwner(null);
  setStorageOwner("user-a");
  saveData("echelon_notification_settings", { leadMinutes: 10 });

  setStorageOwner(null);
  setStorageOwner("user-b");
  assert.deepEqual(loadData("echelon_notification_settings", null), null);

  setStorageOwner(null);
  setStorageOwner("user-a");
  assert.deepEqual(loadData("echelon_notification_settings", null), {
    leadMinutes: 10,
  });
});

test("A to logout to B does not expose A's cache", () => {
  memory.clear();
  setStorageOwner(null);
  setStorageOwner("user-a");
  saveData("echelon_schedule", { owner: "A" });

  setStorageOwner(null);
  setStorageOwner("user-b");

  assert.deepEqual(loadData("echelon_schedule", null), null);
  saveData("echelon_schedule", { owner: "B" });
  assert.deepEqual(loadData("echelon_schedule", null), { owner: "B" });
});

test("B to logout to A restores A without exposing B", () => {
  memory.clear();
  setStorageOwner(null);
  setStorageOwner("user-a");
  saveData("echelon_reviews", [{ owner: "A" }]);
  setStorageOwner(null);
  setStorageOwner("user-b");
  saveData("echelon_reviews", [{ owner: "B" }]);

  setStorageOwner(null);
  setStorageOwner("user-a");

  assert.deepEqual(loadData("echelon_reviews", []), [{ owner: "A" }]);
});

test("malformed legacy data is quarantined instead of migrated", () => {
  memory.clear();
  setStorageOwner(null);
  memory.set("echelon_today", "{not-json");

  setStorageOwner("user-a");

  assert.equal(
    memory.has(getUserStorageKey("user-a", "echelon_today")),
    false,
  );
  assert.equal(memory.get("echelon_today"), "{not-json");
  assert.deepEqual(loadData("echelon_today", null), null);
});

test("repeated legacy migration never overwrites scoped data", () => {
  memory.clear();
  setStorageOwner(null);
  memory.set("echelon_focus", JSON.stringify({ data: ["legacy"] }));
  setStorageOwner("user-a");
  saveData("echelon_focus", { data: ["newer"] });

  migrateStorage();
  setStorageOwner(null);
  setStorageOwner("user-a");

  assert.deepEqual(loadData("echelon_focus", null), { data: ["newer"] });
});

const versionContent = ({ value }) => value;

test("version resolution keeps newer local state", () => {
  const local = { value: "local", revision: 3, updatedAt: "2026-01-03T00:00:00Z" };
  const cloud = { value: "cloud", revision: 2, updatedAt: "2026-01-04T00:00:00Z" };

  assert.deepEqual(resolveVersionedState(local, cloud, versionContent), {
    value: local,
    source: "local",
    shouldUpload: true,
  });
});

test("version resolution accepts newer cloud state", () => {
  const local = { value: "local", revision: 2 };
  const cloud = { value: "cloud", revision: 3 };

  assert.deepEqual(resolveVersionedState(local, cloud, versionContent), {
    value: cloud,
    source: "cloud",
    shouldUpload: false,
  });
});

test("equal revisions and content are idempotent", () => {
  const local = { value: "same", revision: 4, updatedAt: "2026-01-03T00:00:00Z" };
  const cloud = { value: "same", revision: 4, updatedAt: "2026-01-04T00:00:00Z" };

  assert.deepEqual(resolveVersionedState(local, cloud, versionContent), {
    value: local,
    source: "equal",
    shouldUpload: false,
  });
});

test("failed reconciliation upload rejects without selecting older cloud", async () => {
  const local = { value: "unsynced edit", revision: 2 };
  const cloud = { value: "old cloud", revision: 1 };

  await assert.rejects(
    reconcileVersionedState({
      local,
      cloud,
      selectContent: versionContent,
      uploadLocal: async () => {
        throw new Error("offline");
      },
    }),
    /offline/,
  );

  assert.equal(resolveVersionedState(local, cloud, versionContent).value, local);
});

test("legacy data without revisions deterministically favors local on a tie", () => {
  const local = { value: "local legacy" };
  const cloud = { value: "cloud legacy" };

  assert.deepEqual(resolveVersionedState(local, cloud, versionContent), {
    value: local,
    source: "local",
    shouldUpload: true,
  });
});

test("day keys use the local calendar date and detect rollover", () => {
  const localDate = new Date(2026, 0, 2, 0, 15, 0);

  assert.equal(getToday(localDate), "2026-01-02");
  assert.equal(isNewDay(getToday()), false);
  assert.equal(isNewDay("1999-01-01"), true);
});

test("rollover detection changes only when the local calendar day changes", () => {
  const beforeMidnight = new Date(2026, 0, 2, 23, 59, 59, 500);
  const afterMidnight = new Date(2026, 0, 3, 0, 0, 0, 0);

  assert.equal(hasLocalDayChanged("2026-01-02", beforeMidnight), false);
  assert.equal(hasLocalDayChanged("2026-01-02", afterMidnight), true);
});

test("next-day scheduling targets local midnight without frequent polling", () => {
  const beforeMidnight = new Date(2026, 0, 2, 23, 59, 59, 500);
  const midday = new Date(2026, 0, 2, 12, 0, 0, 0);

  assert.equal(getMillisecondsUntilNextLocalDay(beforeMidnight), 500);
  assert.equal(getMillisecondsUntilNextLocalDay(midday), 12 * 60 * 60 * 1000);
});

test("execution scores stay finite and bounded for empty or malformed input", () => {
  assert.equal(calculateExecutionScore({}), 0);
  assert.equal(
    weightedScore({
      taskScore: Infinity,
      habitScore: -20,
      focusMinutes: "invalid",
      workoutScore: 500,
    }),
    10,
  );
  assert.equal(
    calculateExecutionScore({
      tasks: [{ done: true }],
      habits: [{ done: true }],
      focusMinutes: 240,
      hasWorkout: true,
    }),
    100,
  );
});

test("review scoring excludes historical focus and handles rest days", () => {
  const complete = [{ done: true }];
  const sessions = [
    { task: "old", duration: 999999, date: `${localDay(-1)}T10:00:00.000Z` },
    { task: "today", duration: 14400, date: `${localDay()}T10:00:00.000Z` },
    { task: "bad", duration: "nope", date: `${localDay()}T11:00:00.000Z` },
  ];

  const restReview = generateReview({
    tasks: complete,
    habits: complete,
    sessions,
    workoutStats: { completedToday: false, todayWorkout: null },
    scheduledWorkout: { title: "Fun Movement" },
  });

  assert.equal(restReview.focusMinutes, 240);
  assert.equal(restReview.score, 100);

  const requiredReview = generateReview({
    tasks: complete,
    habits: complete,
    sessions,
    workoutStats: { completedToday: false, todayWorkout: null },
    scheduledWorkout: { title: "Strength" },
  });

  assert.equal(requiredReview.score, 90);

  const breakdown = computeReviewBreakdown({
    tasks: null,
    habits: null,
    sessions: [{ duration: "bad", date: `${localDay()}T00:00:00Z` }],
    workoutCompleted: false,
  });

  assert.deepEqual(breakdown.map((item) => item.value), [0, 0, 0, 0]);
});

test("focus histories ignore malformed sessions and merge idempotently", () => {
  const session = {
    id: "focus-1",
    task: "Deep work",
    category: "focus",
    duration: 60,
    date: `${localDay()}T10:00:00.000Z`,
  };

  assert.equal(getTodayFocusTime([null, { duration: 5 }, session]), 60);
  assert.deepEqual(mergeFocusSessions([session], [session]), [session]);
});

test("workout history merge preserves local data and avoids cloud duplicates", () => {
  const session = {
    id: "workout-1",
    workout: "Strength",
    date: localDay(),
    duration: 600,
  };

  assert.deepEqual(mergeWorkoutHistories([session], []), [session]);
  assert.deepEqual(mergeWorkoutHistories([session], [session]), [session]);
  assert.deepEqual(mergeWorkoutHistories([session, session], [session]), [session]);
  assert.deepEqual(getWorkoutStats([null, { workout: "bad" }, session]), {
    totalWorkouts: 1,
    totalMinutes: 10,
    mostTrained: "Strength",
    completedToday: true,
    todayWorkout: session,
  });
});

test("partial workout snapshots are rejected", () => {
  assert.equal(normalizeWorkoutProgress(null), null);
  assert.equal(normalizeWorkoutProgress({ workout: {} }), null);

  const progress = {
    workout: {
      title: "Strength",
      rounds: 1,
      exercises: [{ name: "Squat", duration: 30, rest: 10 }],
    },
    startedAt: new Date().toISOString(),
    elapsed: 5,
    round: 1,
    exerciseIndex: 0,
    phase: "exercise",
    seconds: 25,
  };

  assert.deepEqual(normalizeWorkoutProgress(progress), progress);
  assert.equal(
    normalizeWorkoutProgress({ ...progress, exerciseIndex: 4 }),
    null,
  );
  assert.equal(
    normalizeWorkoutProgress({ ...progress, startedAt: "not-a-date" }),
    null,
  );
});

test("workout completion transitions are idempotent", () => {
  const state = {
    active: true,
    paused: false,
    workout: {
      title: "Strength",
      rounds: 1,
      exercises: [{ name: "Squat", duration: 30, rest: 10 }],
    },
    startedAt: "2026-01-02T10:00:00.000Z",
    elapsed: 30,
    round: 1,
    exerciseIndex: 0,
    phase: "exercise",
    seconds: 10,
  };

  const finished = advanceExercise(state);
  assert.equal(finished.phase, "finished");
  assert.equal(finished.active, false);
  assert.equal(advanceExercise(finished), finished);

  const first = createCompletedSession(finished, "2026-01-02");
  const repeated = createCompletedSession(finished, "2026-01-02");

  assert.deepEqual(first, repeated);
  assert.deepEqual(mergeWorkoutHistories([first], [repeated]), [first]);
  assert.equal(createCompletedSession(state, "2026-01-02"), null);
});

const trackedWorkout = {
  title: "Tracked Strength",
  rounds: 3,
  exercises: [
    { name: "Press", duration: 30, rest: 20 },
    { name: "Row", duration: 40, rest: 30, sets: 2 },
  ],
};

const trackedStartedAt = "2026-01-02T10:00:00.000Z";

test("new workout tracking initializes stable per-exercise set identities", () => {
  const first = initializeWorkoutTracking(trackedWorkout, trackedStartedAt);
  const repeated = initializeWorkoutTracking(trackedWorkout, trackedStartedAt);

  assert.deepEqual(first, repeated);
  assert.equal(first.version, 2);
  assert.equal(first.exercises[0].sets.length, 3);
  assert.equal(first.exercises[1].sets.length, 2);
  assert.equal(first.exercises[0].exerciseId, "exercise:1:press");
  assert.deepEqual(
    first.exercises[0].sets.map((set) => set.id),
    [
      "exercise:1:press:set:1",
      "exercise:1:press:set:2",
      "exercise:1:press:set:3",
    ],
  );
});

test("tracking normalization repairs partial v2 data without creating v2 from legacy", () => {
  const partial = {
    version: 2,
    startedAt: trackedStartedAt,
    exercises: [
      {
        exerciseId: "exercise:1:press",
        name: "Press",
        notes: 42,
        sets: [
          { id: "duplicate", reps: -1, weight: "bad", completed: true },
          { id: "duplicate", reps: "8", weight: "12.5", completed: true },
        ],
      },
    ],
  };
  const normalized = normalizeWorkoutTracking(
    partial,
    trackedWorkout,
    trackedStartedAt,
  );

  assert.equal(normalized.exercises.length, 2);
  assert.equal(normalized.exercises[0].notes, "");
  assert.equal(normalized.exercises[0].sets.length, 3);
  assert.equal(normalized.exercises[0].sets[0].reps, null);
  assert.equal(normalized.exercises[0].sets[0].completed, false);
  assert.equal(normalized.exercises[0].sets[1].reps, 8);
  assert.equal(normalized.exercises[0].sets[1].weight, 12.5);
  assert.equal(new Set(normalized.exercises[0].sets.map((set) => set.id)).size, 3);
  assert.equal(
    normalizeWorkoutTracking({ version: 1 }, trackedWorkout, trackedStartedAt),
    null,
  );

  const shifted = normalizeWorkoutTracking(
    {
      version: 2,
      startedAt: trackedStartedAt,
      exercises: [
        {
          exerciseId: "exercise:2:row",
          name: "Row",
          notes: "Keep with row",
          sets: [{ id: "row-set", reps: 9, completed: false }],
        },
      ],
    },
    trackedWorkout,
    trackedStartedAt,
  );
  assert.equal(shifted.exercises[0].sets[0].reps, null);
  assert.equal(shifted.exercises[1].sets[0].reps, 9);
});

test("tracked reps and weight updates are forgiving and immutable", () => {
  const tracking = initializeWorkoutTracking(trackedWorkout, trackedStartedAt);
  const exercise = tracking.exercises[0];
  const set = exercise.sets[0];
  const withReps = updateTrackingSetValue(
    tracking,
    exercise.exerciseId,
    set.id,
    "reps",
    "10",
  );
  const withWeight = updateTrackingSetValue(
    withReps,
    exercise.exerciseId,
    set.id,
    "weight",
    "12.5",
  );

  assert.equal(tracking.exercises[0].sets[0].reps, null);
  assert.equal(withWeight.exercises[0].sets[0].reps, 10);
  assert.equal(withWeight.exercises[0].sets[0].weight, 12.5);
  assert.equal(
    updateTrackingSetValue(withWeight, exercise.exerciseId, set.id, "reps", -1),
    withWeight,
  );
  assert.equal(
    completeTrackingSet(tracking, exercise.exerciseId, set.id, trackedStartedAt),
    tracking,
  );
});

test("completing and reopening a tracked set are idempotent", () => {
  const tracking = initializeWorkoutTracking(trackedWorkout, trackedStartedAt);
  const exercise = tracking.exercises[0];
  const set = exercise.sets[0];
  const entered = updateTrackingSetValue(
    tracking,
    exercise.exerciseId,
    set.id,
    "reps",
    10,
  );
  const completed = completeTrackingSet(
    entered,
    exercise.exerciseId,
    set.id,
    trackedStartedAt,
  );

  assert.equal(completed.exercises[0].sets[0].completed, true);
  assert.equal(
    completeTrackingSet(completed, exercise.exerciseId, set.id, trackedStartedAt),
    completed,
  );

  const reopened = reopenTrackingSet(completed, exercise.exerciseId, set.id);
  assert.equal(reopened.exercises[0].sets[0].completed, false);
  assert.equal(reopenTrackingSet(reopened, exercise.exerciseId, set.id), reopened);
});

test("extra tracked sets can be added and only removed while incomplete", () => {
  const tracking = initializeWorkoutTracking(trackedWorkout, trackedStartedAt);
  const exercise = tracking.exercises[0];
  const added = addTrackingSet(tracking, exercise.exerciseId);
  const extra = added.exercises[0].sets.at(-1);

  assert.equal(extra.isExtra, true);
  assert.equal(added.exercises[0].sets.length, 4);
  assert.equal(
    removeTrackingSet(added, exercise.exerciseId, exercise.sets[0].id),
    added,
  );

  const entered = updateTrackingSetValue(
    added,
    exercise.exerciseId,
    extra.id,
    "reps",
    5,
  );
  const completed = completeTrackingSet(
    entered,
    exercise.exerciseId,
    extra.id,
    trackedStartedAt,
  );
  assert.equal(
    removeTrackingSet(completed, exercise.exerciseId, extra.id),
    completed,
  );

  const removed = removeTrackingSet(added, exercise.exerciseId, extra.id);
  assert.equal(removed.exercises[0].sets.length, 3);
});

test("tracked exercise notes and current-set derivation persist", () => {
  const tracking = initializeWorkoutTracking(trackedWorkout, trackedStartedAt);
  const exercise = tracking.exercises[0];
  const noted = updateTrackingNotes(
    tracking,
    exercise.exerciseId,
    "Shoulder felt strong",
  );
  const current = deriveCurrentExerciseState(noted, 0);

  assert.equal(current.exercise.notes, "Shoulder felt strong");
  assert.equal(current.currentSet.id, exercise.sets[0].id);
  assert.equal(current.allSetsComplete, false);
});

test("rich tracking survives pause, stop, refresh, and resume snapshots", () => {
  let tracking = initializeWorkoutTracking(trackedWorkout, trackedStartedAt);
  const exercise = tracking.exercises[0];
  tracking = updateTrackingSetValue(
    tracking,
    exercise.exerciseId,
    exercise.sets[0].id,
    "reps",
    10,
  );
  tracking = updateTrackingNotes(tracking, exercise.exerciseId, "Persist me");

  const activeState = {
    workout: trackedWorkout,
    startedAt: trackedStartedAt,
    elapsed: 12,
    round: 1,
    exerciseIndex: 0,
    phase: "exercise",
    seconds: 18,
    tracking,
  };
  const pausedSnapshot = progressFields({
    ...activeState,
    paused: true,
  });
  const stoppedSnapshot = progressFields(pausedSnapshot);
  const refreshed = normalizeWorkoutProgress(
    JSON.parse(JSON.stringify(stoppedSnapshot)),
  );
  const resumed = normalizeWorkoutProgress(refreshed);

  assert.deepEqual(resumed.tracking, tracking);
  assert.equal(resumed.tracking.exercises[0].notes, "Persist me");
  assert.equal(resumed.tracking.exercises[0].sets[0].id, exercise.sets[0].id);
});

test("legacy active snapshots remain legacy after normalization", () => {
  const legacy = {
    workout: trackedWorkout,
    startedAt: trackedStartedAt,
    elapsed: 12,
    round: 1,
    exerciseIndex: 0,
    phase: "exercise",
    seconds: 18,
  };

  assert.deepEqual(normalizeWorkoutProgress(legacy), legacy);
  assert.equal("tracking" in progressFields(legacy), false);
  assert.equal(
    normalizeWorkoutProgress({ ...legacy, tracking: { version: 1 } }),
    null,
  );
});

test("final tracked set uses persisted rest and finishes explicitly", () => {
  const workout = {
    title: "One Set",
    rounds: 1,
    exercises: [{ name: "Squat", duration: 30, rest: 15 }],
  };
  let tracking = initializeWorkoutTracking(workout, trackedStartedAt);
  const exercise = tracking.exercises[0];
  tracking = updateTrackingSetValue(
    tracking,
    exercise.exerciseId,
    exercise.sets[0].id,
    "reps",
    8,
  );
  const state = {
    active: true,
    paused: false,
    workout,
    startedAt: trackedStartedAt,
    elapsed: 30,
    round: 1,
    exerciseIndex: 0,
    phase: "exercise",
    seconds: 0,
    tracking,
  };
  const completedSet = completeTrackedSetState(
    state,
    exercise.exerciseId,
    exercise.sets[0].id,
    trackedStartedAt,
  );

  assert.equal(completedSet.phase, "rest");
  assert.equal(completedSet.seconds, 15);
  const persistedRest = normalizeWorkoutProgress(
    progressFields(completedSet),
  );
  assert.equal(persistedRest.phase, "rest");
  assert.equal(persistedRest.seconds, 15);
  assert.deepEqual(persistedRest.tracking, completedSet.tracking);
  const skipped = skipTrackedRestState(completedSet);
  assert.equal(skipped.seconds, 0);
  assert.equal(skipTrackedRestState(skipped), skipped);
  const restarted = restartTrackedRestState(skipped);
  assert.equal(restarted.seconds, 15);
  assert.equal(restartTrackedRestState(restarted), restarted);
  assert.equal(
    completeTrackedSetState(
      completedSet,
      exercise.exerciseId,
      exercise.sets[0].id,
      trackedStartedAt,
    ),
    completedSet,
  );

  const reopenedTracking = reopenTrackingSet(
    completedSet.tracking,
    exercise.exerciseId,
    exercise.sets[0].id,
  );
  assert.equal(
    deriveCurrentExerciseState(reopenedTracking, 0).currentSet.id,
    exercise.sets[0].id,
  );

  const reopenedState = { ...completedSet, tracking: reopenedTracking };
  const resumedSet = continueTrackedWorkoutState(
    skipTrackedRestState(reopenedState),
  );
  assert.equal(resumedSet.phase, "exercise");
  const reCompleted = completeTrackedSetState(
    resumedSet,
    exercise.exerciseId,
    exercise.sets[0].id,
    trackedStartedAt,
  );
  const rested = skipTrackedRestState(reCompleted);
  const finished = continueTrackedWorkoutState(rested);
  assert.equal(finished.phase, "finished");
  assert.equal(finished.active, false);
  assert.equal(continueTrackedWorkoutState(finished), finished);

  const trackingBeforeCompletion = JSON.stringify(finished.tracking);
  const first = createCompletedSession(finished, "2026-01-02");
  const repeated = createCompletedSession(finished, "2026-01-02");
  assert.equal(first.id, `${trackedStartedAt}|One Set`);
  assert.deepEqual(first, repeated);
  assert.deepEqual(first.tracking, finished.tracking);
  assert.equal(JSON.stringify(finished.tracking), trackingBeforeCompletion);
  assert.deepEqual(mergeWorkoutHistories([first], [repeated]), [first]);
  assert.equal(first.tracking.version, 2);
});

test("tracked sessions cannot advance while the current exercise has open sets", () => {
  const workout = {
    title: "Two Sets",
    rounds: 2,
    exercises: [{ name: "Squat", duration: 30, rest: 10 }],
  };
  let tracking = initializeWorkoutTracking(workout, trackedStartedAt);
  const exercise = tracking.exercises[0];
  tracking = updateTrackingSetValue(
    tracking,
    exercise.exerciseId,
    exercise.sets[0].id,
    "reps",
    8,
  );
  const state = {
    active: true,
    paused: false,
    workout,
    startedAt: trackedStartedAt,
    elapsed: 30,
    round: 1,
    exerciseIndex: 0,
    phase: "exercise",
    seconds: 0,
    tracking,
  };
  const firstSet = completeTrackedSetState(
    state,
    exercise.exerciseId,
    exercise.sets[0].id,
    trackedStartedAt,
  );
  const continued = continueTrackedWorkoutState(
    skipTrackedRestState(firstSet),
  );

  assert.equal(continued.active, true);
  assert.equal(continued.phase, "exercise");
  assert.equal(continued.exerciseIndex, 0);
  assert.equal(
    deriveCurrentExerciseState(continued.tracking, 0).currentSet.id,
    exercise.sets[1].id,
  );
});

test("tracked next-exercise transitions cannot be applied twice", () => {
  const workout = {
    title: "Two Exercises",
    rounds: 1,
    exercises: [
      { name: "Press", duration: 30, rest: 10 },
      { name: "Row", duration: 30, rest: 10 },
    ],
  };
  let tracking = initializeWorkoutTracking(workout, trackedStartedAt);
  const exercise = tracking.exercises[0];
  tracking = updateTrackingSetValue(
    tracking,
    exercise.exerciseId,
    exercise.sets[0].id,
    "reps",
    8,
  );
  const completed = completeTrackedSetState(
    {
      active: true,
      paused: false,
      workout,
      startedAt: trackedStartedAt,
      elapsed: 30,
      round: 1,
      exerciseIndex: 0,
      phase: "exercise",
      seconds: 0,
      tracking,
    },
    exercise.exerciseId,
    exercise.sets[0].id,
    trackedStartedAt,
  );
  const nextExercise = continueTrackedWorkoutState(
    skipTrackedRestState(completed),
  );

  assert.equal(nextExercise.exerciseIndex, 1);
  assert.equal(nextExercise.phase, "prepare");
  assert.equal(continueTrackedWorkoutState(nextExercise), nextExercise);
});

test("tracked sessions recover earlier incomplete exercises before finishing", () => {
  const workout = {
    title: "Corrupt Recovery",
    rounds: 1,
    exercises: [
      { name: "Press", duration: 30, rest: 10 },
      { name: "Row", duration: 30, rest: 10 },
    ],
  };
  let tracking = initializeWorkoutTracking(workout, trackedStartedAt);
  const finalExercise = tracking.exercises[1];
  tracking = updateTrackingSetValue(
    tracking,
    finalExercise.exerciseId,
    finalExercise.sets[0].id,
    "reps",
    8,
  );
  tracking = completeTrackingSet(
    tracking,
    finalExercise.exerciseId,
    finalExercise.sets[0].id,
    trackedStartedAt,
  );

  const recovered = continueTrackedWorkoutState({
    active: true,
    paused: false,
    workout,
    startedAt: trackedStartedAt,
    elapsed: 30,
    round: 1,
    exerciseIndex: 1,
    phase: "rest",
    seconds: 0,
    tracking,
  });

  assert.equal(recovered.active, true);
  assert.equal(recovered.phase, "prepare");
  assert.equal(recovered.exerciseIndex, 0);

  const corruptFinished = {
    ...recovered,
    active: false,
    exerciseIndex: 1,
    phase: "finished",
    seconds: 0,
  };
  assert.equal(normalizeWorkoutProgress(corruptFinished), null);
  assert.equal(createCompletedSession(corruptFinished, "2026-01-02"), null);
});

test("previous performance and metrics use tracked sessions only", () => {
  let older = initializeWorkoutTracking(trackedWorkout, trackedStartedAt);
  const exercise = older.exercises[0];
  older = updateTrackingSetValue(
    older,
    exercise.exerciseId,
    exercise.sets[0].id,
    "reps",
    10,
  );
  older = updateTrackingSetValue(
    older,
    exercise.exerciseId,
    exercise.sets[0].id,
    "weight",
    12,
  );
  older = completeTrackingSet(
    older,
    exercise.exerciseId,
    exercise.sets[0].id,
    trackedStartedAt,
  );
  const trackedSession = {
    id: "tracked",
    workout: trackedWorkout.title,
    date: "2026-01-02",
    duration: 30,
    tracking: older,
  };
  const previous = derivePreviousPerformance(
    [
      trackedSession,
      { workout: "Legacy", date: "2026-01-03", duration: 30 },
    ],
    exercise.exerciseId,
  );

  assert.equal(previous.date, "2026-01-02");
  assert.equal(previous.sets[0].reps, 10);
  assert.deepEqual(getTrackingMetrics(older), {
    totalSets: 1,
    totalReps: 10,
    totalVolume: 120,
  });
  assert.deepEqual(
    mergeWorkoutHistories([trackedSession], [trackedSession])[0].tracking,
    older,
  );
});

test("previous performance selects the latest valid completed tracked sets", () => {
  const exerciseId = "exercise:1:press";
  const buildSession = (startedAt, date, reps) => {
    let tracking = initializeWorkoutTracking(trackedWorkout, startedAt);
    const setId = tracking.exercises[0].sets[0].id;
    tracking = updateTrackingSetValue(
      tracking,
      exerciseId,
      setId,
      "reps",
      reps,
    );
    tracking = completeTrackingSet(
      tracking,
      exerciseId,
      setId,
      startedAt,
    );

    return {
      workout: trackedWorkout.title,
      date,
      duration: 30,
      tracking,
    };
  };
  const older = buildSession("2026-01-02T10:00:00.000Z", "2026-01-02", 8);
  const latest = buildSession("2026-01-04T10:00:00.000Z", "2026-01-04", 10);
  const malformedNewer = {
    ...buildSession("2026-01-05T10:00:00.000Z", "2026-01-05", 12),
  };
  malformedNewer.tracking.exercises[0].sets[0] = {
    ...malformedNewer.tracking.exercises[0].sets[0],
    completed: false,
    completedAt: null,
  };

  const previous = derivePreviousPerformance(
    [older, malformedNewer, latest],
    exerciseId,
  );

  assert.equal(previous.date, "2026-01-04");
  assert.equal(previous.sets[0].reps, 10);
});

test("tracking volume handles null, zero, and decimal weight exactly", () => {
  let tracking = initializeWorkoutTracking(trackedWorkout, trackedStartedAt);
  const exercise = tracking.exercises[0];
  const inputs = [
    { reps: 10, weight: null },
    { reps: 5, weight: 0 },
    { reps: 3, weight: 0.1 },
  ];

  exercise.sets.forEach((set, index) => {
    tracking = updateTrackingSetValue(
      tracking,
      exercise.exerciseId,
      set.id,
      "reps",
      inputs[index].reps,
    );
    if (inputs[index].weight !== null) {
      tracking = updateTrackingSetValue(
        tracking,
        exercise.exerciseId,
        set.id,
        "weight",
        inputs[index].weight,
      );
    }
    tracking = completeTrackingSet(
      tracking,
      exercise.exerciseId,
      set.id,
      trackedStartedAt,
    );
  });

  assert.deepEqual(getTrackingMetrics(tracking), {
    totalSets: 3,
    totalReps: 18,
    totalVolume: 0.3,
  });
});

test("workout streak ignores duplicate dates and malformed entries", () => {
  const workouts = [
    { workout: "A", date: localDay(), duration: 1 },
    { workout: "B", date: localDay(), duration: 2 },
    { workout: "A", date: localDay(-1), duration: 3 },
    { workout: "bad", date: "not-a-date", duration: 4 },
  ];

  assert.equal(getWorkoutStreak(workouts), 2);
});

test("workout history sorts valid local dates and ignores malformed entries", () => {
  const history = [
    { id: "middle", workout: "Pull", date: "2026-03-15", duration: 20 },
    { id: "newest", workout: "Legs", date: "2026-04-01", duration: 30 },
    { id: "invalid", workout: "Bad", date: "2026-02-30", duration: 40 },
    { id: "oldest", workout: "Push", date: "2025-12-31", duration: 10 },
  ];

  assert.deepEqual(
    sortWorkoutHistory(history).map((session) => session.id),
    ["newest", "middle", "oldest"],
  );
  assert.deepEqual(
    sortWorkoutHistory(history, "asc").map((session) => session.id),
    ["oldest", "middle", "newest"],
  );
});

test("workout history groups dates while safely deduplicating legacy entries", () => {
  const duplicate = {
    workout: "Push",
    date: "2026-01-02",
    duration: 600,
  };
  const groups = groupWorkoutHistoryByDate([
    duplicate,
    duplicate,
    { id: "second", workout: "Core", date: "2026-01-02", duration: 300 },
    { workout: "Invalid", date: "not-a-date", duration: 10 },
  ]);

  assert.deepEqual(Object.keys(groups), ["2026-01-02"]);
  assert.equal(groups["2026-01-02"].length, 2);
});

test("workout history finds previous and next completed dates", () => {
  const history = [
    { workout: "A", date: "2026-01-01", duration: 1 },
    { workout: "B", date: "2026-01-03", duration: 1 },
    { workout: "C", date: "2026-01-03", duration: 2 },
    { workout: "D", date: "2026-02-01", duration: 1 },
  ];

  assert.deepEqual(getAdjacentWorkoutDates(history, "2026-01-03"), {
    previous: "2026-01-01",
    next: "2026-02-01",
  });
  assert.deepEqual(getAdjacentWorkoutDates(history, "2026-01-02"), {
    previous: null,
    next: null,
  });
});

test("calendar month derivation preserves month boundaries", () => {
  const january = getCalendarMonth(2026, 0);

  assert.equal(january.length, 42);
  assert.equal(january[4].date, "2026-01-01");
  assert.equal(january[34].date, "2026-01-31");
  assert.equal(january[35], null);
  assert.deepEqual(shiftCalendarMonth({ year: 2026, month: 0 }, -1), {
    year: 2025,
    month: 11,
  });
  assert.deepEqual(shiftCalendarMonth({ year: 2026, month: 11 }, 1), {
    year: 2027,
    month: 0,
  });
});

test("calendar month derivation handles leap years", () => {
  const leapFebruary = getCalendarMonth(2024, 1).filter(Boolean);
  const commonFebruary = getCalendarMonth(2025, 1).filter(Boolean);

  assert.equal(leapFebruary.length, 29);
  assert.equal(leapFebruary.at(-1).date, "2024-02-29");
  assert.equal(commonFebruary.length, 28);
  assert.equal(commonFebruary.at(-1).date, "2025-02-28");
});

test("workout navigation helpers tolerate invalid and empty history", () => {
  assert.deepEqual(sortWorkoutHistory(null), []);
  assert.deepEqual(groupWorkoutHistoryByDate([]), {});
  assert.deepEqual(getAdjacentWorkoutDates([], "2026-01-01"), {
    previous: null,
    next: null,
  });
  assert.deepEqual(getCalendarMonth(2026, 12), []);
  assert.deepEqual(getCalendarMonth(Number.NaN, 0), []);
});

const trackedInsightSession = ({
  id,
  date,
  exerciseId = "exercise:press",
  name = "Press",
  sets,
  notes = "",
  startedAt = `${date}T10:00:00.000Z`,
}) => ({
  id,
  workout: "Tracked Strength",
  date,
  duration: 1200,
  tracking: {
    version: 2,
    startedAt,
    exercises: [
      {
        exerciseId,
        name,
        notes,
        sets: sets.map((set, index) => ({
          id: `${exerciseId}:set:${index + 1}`,
          reps: set.reps,
          weight: set.weight ?? null,
          completed: set.completed !== false,
          completedAt:
            set.completed === false ? null : `${date}T10:05:00.000Z`,
          isExtra: false,
        })),
      },
    ],
  },
});

test("tracked insights extract v2 history only and keep legacy in overall totals", () => {
  const tracked = trackedInsightSession({
    id: "tracked",
    date: "2026-01-02",
    sets: [{ reps: 10, weight: 12 }],
  });
  const legacy = {
    id: "legacy",
    workout: "Legacy",
    date: "2026-01-01",
    duration: 600,
  };
  const malformed = { ...tracked, id: "bad", tracking: { version: 2 } };

  assert.deepEqual(
    extractTrackedSessions([legacy, malformed, tracked]).map(
      (session) => session.id,
    ),
    ["tracked"],
  );
  assert.equal(getWorkoutStats([legacy, tracked]).totalWorkouts, 2);
  assert.equal(
    getTrackedProgressSummary(
      [legacy, tracked],
      new Date(2026, 0, 2, 12),
    ).trackedSessions,
    1,
  );
});

test("exercise grouping uses stable IDs and the latest retained name", () => {
  const older = trackedInsightSession({
    id: "older",
    date: "2026-01-01",
    exerciseId: "exercise:press",
    name: "Old Press Name",
    sets: [{ reps: 8, weight: 10 }],
  });
  const latest = trackedInsightSession({
    id: "latest",
    date: "2026-01-03",
    exerciseId: "exercise:press",
    name: "Standing Press",
    sets: [{ reps: 9, weight: 10 }],
  });
  const groups = groupTrackedPerformanceByExercise([older, latest]);

  assert.equal(groups.size, 1);
  assert.equal(groups.get("exercise:press").name, "Standing Press");
  assert.deepEqual(
    groups.get("exercise:press").occurrences.map((item) => item.date),
    ["2026-01-03", "2026-01-01"],
  );
});

test("exercise PRs derive weight, reps, set volume, and session volume", () => {
  const sessions = [
    trackedInsightSession({
      id: "one",
      date: "2026-01-01",
      sets: [
        { reps: 10, weight: 12.5 },
        { reps: 8, weight: 12.5 },
      ],
    }),
    trackedInsightSession({
      id: "two",
      date: "2026-01-03",
      sets: [
        { reps: 6, weight: 15 },
        { reps: 12, weight: 10 },
      ],
    }),
  ];
  const performance = getExercisePerformance(sessions, "exercise:press");
  const prs = computeExercisePRs(performance.occurrences);

  assert.equal(prs.heaviestWeight.value, 15);
  assert.equal(prs.mostReps.value, 12);
  assert.equal(prs.bestSetVolume.value, 125);
  assert.equal(prs.bestSessionVolume.value, 225);
});

test("bodyweight exercise PRs remain rep-based without weight PRs", () => {
  const session = trackedInsightSession({
    id: "bodyweight",
    date: "2026-01-01",
    sets: [{ reps: 12 }, { reps: 15 }],
  });
  const prs = computeExercisePRs(
    getExercisePerformance([session], "exercise:press").occurrences,
  );

  assert.equal(prs.heaviestWeight, null);
  assert.equal(prs.bestSetVolume, null);
  assert.equal(prs.bestSessionVolume, null);
  assert.equal(prs.mostReps.value, 15);
});

test("tied PRs prefer the earliest achievement date", () => {
  const earliest = trackedInsightSession({
    id: "earliest",
    date: "2026-01-01",
    sets: [{ reps: 10, weight: 20 }],
  });
  const later = trackedInsightSession({
    id: "later",
    date: "2026-01-05",
    sets: [{ reps: 10, weight: 20 }],
  });
  const prs = computeExercisePRs(
    getExercisePerformance([later, earliest], "exercise:press").occurrences,
  );

  assert.equal(prs.heaviestWeight.date, "2026-01-01");
  assert.equal(prs.mostReps.date, "2026-01-01");
  assert.equal(prs.bestSetVolume.date, "2026-01-01");
  assert.equal(prs.bestSessionVolume.date, "2026-01-01");
});

test("tracked insights exclude malformed and incomplete sets", () => {
  const session = trackedInsightSession({
    id: "partial",
    date: "2026-01-01",
    sets: [
      { reps: 10, weight: 5 },
      { reps: 99, weight: 99, completed: false },
      { reps: -2, weight: 10 },
    ],
  });
  const occurrence = getExercisePerformance(
    [session],
    "exercise:press",
  ).occurrences[0];

  assert.equal(occurrence.totalSets, 1);
  assert.equal(occurrence.totalReps, 10);
  assert.equal(occurrence.weightedVolume, 50);
});

test("latest versus previous comparison is factual and newest-first", () => {
  const older = trackedInsightSession({
    id: "older",
    date: "2026-01-01",
    sets: [{ reps: 8, weight: 12 }, { reps: 8, weight: 12 }],
  });
  const latest = trackedInsightSession({
    id: "latest",
    date: "2026-01-03",
    sets: [{ reps: 10, weight: 12 }, { reps: 9, weight: 12 }],
  });
  const performance = getExercisePerformance(
    [latest, older],
    "exercise:press",
  );
  const comparison = compareLatestExerciseSessions(performance.occurrences);

  assert.equal(comparison.latest.date, "2026-01-03");
  assert.equal(comparison.previous.date, "2026-01-01");
  assert.equal(comparison.totalRepsDelta, 3);
  assert.equal(comparison.weightedVolumeDelta, 36);
});

test("weekly tracked aggregates preserve local week boundaries across years", () => {
  const sessions = [
    trackedInsightSession({
      id: "december",
      date: "2025-12-31",
      sets: [{ reps: 3, weight: 2.5 }],
    }),
    trackedInsightSession({
      id: "january",
      date: "2026-01-01",
      sets: [{ reps: 4, weight: 2.5 }],
    }),
    trackedInsightSession({
      id: "next-week",
      date: "2026-01-05",
      sets: [{ reps: 5, weight: 2.5 }],
    }),
  ];

  assert.equal(getWeekStartDayKey("2026-01-01"), "2025-12-29");
  assert.deepEqual(getWeeklyTrackedAggregates(sessions), [
    {
      week: "2025-12-29",
      workouts: 2,
      totalSets: 2,
      totalReps: 7,
      weightedVolume: 17.5,
    },
    {
      week: "2026-01-05",
      workouts: 1,
      totalSets: 1,
      totalReps: 5,
      weightedVolume: 12.5,
    },
  ]);
});

test("decimal volume is rounded consistently per set and aggregate", () => {
  const session = trackedInsightSession({
    id: "decimal",
    date: "2026-01-01",
    sets: [{ reps: 3, weight: 1.111 }, { reps: 2, weight: 2.222 }],
  });
  const occurrence = getExercisePerformance(
    [session],
    "exercise:press",
  ).occurrences[0];
  const prs = computeExercisePRs([occurrence]);

  assert.equal(occurrence.weightedVolume, 7.78);
  assert.equal(prs.bestSetVolume.value, 4.44);
  assert.equal(prs.bestSessionVolume.value, 7.78);
});

test("empty and single-session histories do not fabricate comparisons", () => {
  assert.equal(getExercisePerformance([], "exercise:press"), null);
  assert.equal(compareLatestExerciseSessions([]), null);

  const session = trackedInsightSession({
    id: "single",
    date: "2026-01-01",
    sets: [{ reps: 5, weight: 0 }],
  });
  const occurrence = getExercisePerformance(
    [session],
    "exercise:press",
  ).occurrences;

  assert.equal(compareLatestExerciseSessions(occurrence), null);
  assert.equal(computeExercisePRs(occurrence).heaviestWeight.value, 0);
});

test("multiple tracked workouts on one date remain distinct in aggregates", () => {
  const first = trackedInsightSession({
    id: "same-day-one",
    date: "2026-01-06",
    sets: [{ reps: 5, weight: 10 }],
    startedAt: "2026-01-06T08:00:00.000Z",
  });
  const second = trackedInsightSession({
    id: "same-day-two",
    date: "2026-01-06",
    sets: [{ reps: 8, weight: 10 }],
    startedAt: "2026-01-06T18:00:00.000Z",
  });
  const summary = getTrackedProgressSummary(
    [first, second],
    new Date(2026, 0, 6, 20),
  );
  const weekly = getWeeklyTrackedAggregates([first, second]);
  const exercise = getExercisePerformance(
    [first, second],
    "exercise:press",
  );

  assert.equal(summary.trackedSessions, 2);
  assert.equal(summary.totalSets, 2);
  assert.equal(summary.totalReps, 13);
  assert.equal(summary.weightedVolume, 130);
  assert.equal(weekly[0].workouts, 2);
  assert.equal(exercise.occurrences.length, 2);
  assert.equal(exercise.occurrences[0].startedAt, second.tracking.startedAt);
});

test("workout insight derivation does not mutate persisted history", () => {
  const session = trackedInsightSession({
    id: "immutable",
    date: "2026-01-07",
    sets: [{ reps: "6", weight: "7.5" }],
  });
  const before = structuredClone(session);

  const extracted = extractTrackedSessions([session]);
  getTrackedProgressSummary([session], new Date(2026, 0, 7, 12));
  getWeeklyTrackedAggregates([session]);
  computeExercisePRs(
    getExercisePerformance([session], "exercise:press").occurrences,
  );

  assert.deepEqual(session, before);
  assert.notEqual(extracted[0], session);
  assert.notEqual(extracted[0].tracking, session.tracking);
});

test("workout plan selection defaults to the current local day", () => {
  const localDate = new Date(2026, 8, 14, 23, 30);

  assert.equal(getDefaultWorkoutPlanDate(localDate), "2026-09-14");
  assert.equal(getWorkoutForDate("2026-09-14")?.day, "MON");
});

test("workout plan date navigation crosses month and year boundaries locally", () => {
  assert.equal(shiftWorkoutPlanDate("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftWorkoutPlanDate("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftWorkoutPlanDate("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftWorkoutPlanDate("bad-date", 1), null);
});

test("selecting yesterday resolves its prescribed workout including recovery", () => {
  const today = getDefaultWorkoutPlanDate(new Date(2026, 8, 14, 12));
  const yesterday = shiftWorkoutPlanDate(today, -1);

  assert.equal(yesterday, "2026-09-13");
  assert.equal(getWorkoutForDate(yesterday)?.title, "Recovery");
  assert.equal(getWorkoutForDate(yesterday)?.day, "SUN");
  assert.equal(getWorkoutForDate("not-a-date"), null);
});

test("selected plan origin survives progress and keeps actual completion date", () => {
  const performedDate = getToday();
  const planDate = shiftWorkoutPlanDate(performedDate, -1);
  const workout = {
    title: "Selected Plan",
    rounds: 1,
    exercises: [{ name: "Press", duration: 30, rest: 10, sets: 1 }],
  };
  const startedAt = new Date();
  const initial = {
    active: false,
    savedProgress: null,
    sessions: [],
  };
  let started = createWorkoutStartState(
    initial,
    workout,
    planDate,
    startedAt,
  );
  const exercise = started.tracking.exercises[0];
  let tracking = updateTrackingSetValue(
    started.tracking,
    exercise.exerciseId,
    exercise.sets[0].id,
    "reps",
    8,
  );
  tracking = completeTrackingSet(
    tracking,
    exercise.exerciseId,
    exercise.sets[0].id,
    startedAt,
  );
  started = { ...started, active: false, phase: "finished", tracking };

  const persisted = progressFields(started);
  const restored = normalizeWorkoutProgress(persisted);
  const completed = createCompletedSession(started, performedDate);

  assert.equal(restored.planDate, planDate);
  assert.equal(completed.date, performedDate);
  assert.equal(completed.planDate, planDate);
  assert.equal(getWorkoutStats([completed]).completedToday, true);
  assert.equal(getWorkoutStreak([completed]), 1);
});

test("an active or resumable workout cannot be replaced by another plan", () => {
  const workout = getWorkoutForDate("2026-09-14");
  const replacement = getWorkoutForDate("2026-09-15");
  const active = createWorkoutStartState(
    { active: false, savedProgress: null },
    workout,
    "2026-09-14",
    new Date(2026, 8, 14, 8),
  );
  const blockedActive = createWorkoutStartState(
    active,
    replacement,
    "2026-09-15",
    new Date(2026, 8, 14, 9),
  );
  const resumable = {
    active: false,
    savedProgress: progressFields(active),
  };

  assert.equal(blockedActive, active);
  assert.equal(
    createWorkoutStartState(
      resumable,
      replacement,
      "2026-09-15",
      new Date(2026, 8, 14, 9),
    ),
    resumable,
  );
});

test("legacy workout completions remain valid without plan origin metadata", () => {
  const legacy = {
    id: "legacy-no-plan-date",
    workout: "Legacy",
    date: "2026-09-14",
    duration: 600,
  };

  assert.deepEqual(normalizeWorkoutHistory([legacy]), [legacy]);
});

test("workout store imports only authoritative workoutStorage exports", () => {
  const storeSource = readFileSync(
    new URL("../src/features/workout/store.js", import.meta.url),
    "utf8",
  );
  const storageSource = readFileSync(
    new URL("../src/features/workout/workoutStorage.js", import.meta.url),
    "utf8",
  );
  const storageImport = storeSource.match(
    /import\s*{([^}]*)}\s*from\s*["']\.\/workoutStorage(?:\.js)?["'];/,
  );

  assert.ok(storageImport);
  const importedNames = storageImport[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  importedNames.forEach((name) => {
    assert.match(
      storageSource,
      new RegExp(`export\\s+(?:function|const|class)\\s+${name}\\b`),
    );
  });
  assert.equal(storeSource.includes("createWorkoutProgressSnapshot"), false);
  assert.equal(storageSource.includes("createWorkoutProgressSnapshot"), false);
});

test("analytics sanitizes partial histories without NaN or Infinity", () => {
  assert.deepEqual(normalizeProgressHistory(null), []);
  assert.deepEqual(
    normalizeProgressHistory([
      null,
      { date: "2026-01-01", progress: Infinity },
      { date: "2026-01-02", progress: 150 },
    ]),
    [{ date: "2026-01-02", progress: 100 }],
  );

  assert.deepEqual(generateWeeklyInsights([null, { score: "bad" }]), {
    average: 0,
    best: null,
    worst: null,
    totalFocus: 0,
  });
});

test("review and schedule persistence reject partial shapes safely", () => {
  const cloudReview = { date: "2026-01-01", score: 10 };
  const localReview = { date: "2026-01-01", score: 80 };

  assert.deepEqual(
    mergeReviews([cloudReview, null], [localReview]),
    [localReview],
  );
  assert.equal(normalizeSchedule([{ id: 1 }]), defaultSchedule);
  assert.equal(normalizeDailyTasks([{ id: 1 }]), null);

  const validTasks = defaultSchedule.map((task) => ({ ...task, done: "yes" }));
  assert.equal(normalizeDailyTasks(validTasks).every((task) => !task.done), true);
});

const scheduleTask = {
  id: 6,
  start: "20:00",
  end: "21:00",
  title: "Physics",
  category: "focus",
  description: "Study",
};

test("schedule reminder IDs are deterministic and change with timing", () => {
  const input = {
    source: "schedule",
    sourceId: 6,
    date: "2026-01-02",
    start: "20:00",
    leadMinutes: 10,
  };

  assert.equal(createReminderId(input), createReminderId(input));
  assert.notEqual(
    createReminderId(input),
    createReminderId({ ...input, start: "20:05" }),
  );
});

test("reminder times support zero and ten-minute lead times", () => {
  const atStart = calculateReminderTime("2026-01-02", "20:00", 0);
  const tenMinutesBefore = calculateReminderTime("2026-01-02", "20:00", 10);

  assert.deepEqual(
    [atStart.getFullYear(), atStart.getMonth(), atStart.getDate(), atStart.getHours(), atStart.getMinutes()],
    [2026, 0, 2, 20, 0],
  );
  assert.deepEqual(
    [tenMinutesBefore.getHours(), tenMinutesBefore.getMinutes()],
    [19, 50],
  );
});

test("reminder calculation preserves local-day boundary crossings", () => {
  const reminder = calculateReminderTime("2026-01-02", "00:05", 10);

  assert.equal(getToday(reminder), "2026-01-01");
  assert.deepEqual([reminder.getHours(), reminder.getMinutes()], [23, 55]);
});

test("scheduler derivation includes tomorrow reminders that fire today", () => {
  const reminders = deriveScheduleReminders(
    [{ ...scheduleTask, start: "00:05" }],
    DEFAULT_NOTIFICATION_SETTINGS,
    new Date(2026, 0, 2, 23, 50),
  );

  assert.equal(
    reminders.some(
      (reminder) =>
        reminder.date === "2026-01-03" &&
        getToday(new Date(reminder.scheduledFor)) === "2026-01-02",
    ),
    true,
  );
});

test("quiet hours handle normal and cross-midnight ranges", () => {
  const evening = new Date(2026, 0, 2, 23, 0);
  const earlyMorning = new Date(2026, 0, 3, 6, 0);
  const midday = new Date(2026, 0, 3, 12, 0);

  assert.equal(
    isWithinQuietHours(evening, {
      enabled: true,
      start: "18:00",
      end: "23:30",
    }),
    true,
  );
  assert.equal(
    isWithinQuietHours(midday, {
      enabled: true,
      start: "18:00",
      end: "23:30",
    }),
    false,
  );
  assert.equal(
    isWithinQuietHours(earlyMorning, {
      enabled: true,
      start: "22:30",
      end: "06:30",
    }),
    true,
  );
  assert.equal(
    isWithinQuietHours(midday, {
      enabled: true,
      start: "22:30",
      end: "06:30",
    }),
    false,
  );
});

const createFakeScheduler = (now = new Date(2026, 0, 2, 10, 0)) => {
  let nextHandle = 0;
  const callbacks = new Map();
  const cleared = [];
  const scheduler = createReminderScheduler({
    now: () => now,
    setTimer: (callback, delay) => {
      const handle = ++nextHandle;
      callbacks.set(handle, { callback, delay });
      return handle;
    },
    clearTimer: (handle) => {
      cleared.push(handle);
      callbacks.delete(handle);
    },
  });

  return { scheduler, callbacks, cleared };
};

test("scheduler prevents duplicate timers for the same reminder", () => {
  const reminder = createScheduleReminder(scheduleTask, "2026-01-02", 10);
  const fake = createFakeScheduler();

  fake.scheduler.reconcile([reminder], () => {});
  const firstHandle = [...fake.callbacks.keys()][0];
  fake.scheduler.reconcile([reminder], () => {});

  assert.deepEqual(fake.scheduler.getScheduledIds(), [reminder.id]);
  assert.deepEqual([...fake.callbacks.keys()], [firstHandle]);
});

test("persisted terminal status prevents delivery after refresh", () => {
  const reminder = createScheduleReminder(scheduleTask, "2026-01-02", 10);
  const plan = planReminders(
    [reminder],
    [{ ...reminder, status: "fired" }],
    new Date(2026, 0, 2, 10, 0),
  );

  assert.deepEqual(plan, { schedulable: [], missed: [] });
});

test("schedule edits invalidate the old reminder timer", () => {
  const original = createScheduleReminder(scheduleTask, "2026-01-02", 10);
  const edited = createScheduleReminder(
    { ...scheduleTask, start: "20:30" },
    "2026-01-02",
    10,
  );
  const fake = createFakeScheduler();

  fake.scheduler.reconcile([original], () => {});
  fake.scheduler.reconcile([edited], () => {});

  assert.deepEqual(fake.scheduler.getScheduledIds(), [edited.id]);
  assert.equal(fake.cleared.length, 1);
});

test("schedule removal cancels its reminder timer", () => {
  const reminder = createScheduleReminder(scheduleTask, "2026-01-02", 10);
  const fake = createFakeScheduler();

  fake.scheduler.reconcile([reminder], () => {});
  fake.scheduler.reconcile([], () => {});

  assert.deepEqual(fake.scheduler.getScheduledIds(), []);
  assert.equal(fake.cleared.length, 1);
});

test("recently due reminders use the grace window", () => {
  const now = new Date(2026, 0, 2, 20, 3);
  const reminder = createScheduleReminder(scheduleTask, "2026-01-02", 0);
  const plan = planReminders([reminder], [], now, REMINDER_GRACE_MS);

  assert.deepEqual(plan.schedulable, [reminder]);
  assert.deepEqual(plan.missed, []);
});

test("old reminders are marked missed without delivery", () => {
  const now = new Date(2026, 0, 2, 20, 6);
  const reminder = createScheduleReminder(scheduleTask, "2026-01-02", 0);
  const plan = planReminders([reminder], [], now, REMINDER_GRACE_MS);

  assert.deepEqual(plan.schedulable, []);
  assert.deepEqual(plan.missed, [reminder]);
});

test("disabled schedule reminders derive no work", () => {
  const reminders = deriveScheduleReminders(
    [scheduleTask],
    { ...DEFAULT_NOTIFICATION_SETTINGS, scheduleEnabled: false },
    new Date(2026, 0, 2, 10, 0),
  );

  assert.deepEqual(reminders, []);
});

test("permission boundaries handle unsupported and denied without reprompting", async () => {
  let prompts = 0;
  const deniedApi = {
    permission: "denied",
    requestPermission: async () => {
      prompts += 1;
      return "granted";
    },
  };

  assert.equal(getNotificationPermission(undefined), "unsupported");
  assert.equal(await requestNotificationPermission(deniedApi), "denied");
  assert.equal(prompts, 0);
  assert.equal(
    canUseBrowserNotifications(
      { browserEnabled: true },
      "denied",
      false,
    ),
    false,
  );
});
