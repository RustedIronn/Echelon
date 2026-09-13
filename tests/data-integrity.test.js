import assert from "node:assert/strict";
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
  normalizeWorkoutProgress,
} from "../src/features/workout/workoutStorage.js";
import {
  advanceExercise,
  createCompletedSession,
} from "../src/features/workout/state.js";
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

test("workout streak ignores duplicate dates and malformed entries", () => {
  const workouts = [
    { workout: "A", date: localDay(), duration: 1 },
    { workout: "B", date: localDay(), duration: 2 },
    { workout: "A", date: localDay(-1), duration: 3 },
    { workout: "bad", date: "not-a-date", duration: 4 },
  ];

  assert.equal(getWorkoutStreak(workouts), 2);
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
