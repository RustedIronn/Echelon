import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  calculateExecutionScore,
  weightedScore,
} from "../src/shared/executionScore.js";
import {
  getToday,
  getLocalWeekRange,
  isNewDay,
  isValidDayKey,
  parseDayKey,
} from "../src/shared/date.js";
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
  subscribeStorageOwner,
} from "../src/shared/storage.js";
import {
  reconcileVersionedState,
  resolveVersionedState,
} from "../src/shared/versionedState.js";
import {
  getWorkoutStats,
  getWorkoutStreak,
} from "../src/features/workouts/js/analyzer.js";
import {
  mergeWorkoutHistories,
  normalizeWorkoutHistory,
  normalizeWorkoutProgress,
  progressFields,
} from "../src/features/workouts/js/workoutStorage.js";
import {
  advanceExercise,
  completeTrackedSetState,
  continueTrackedWorkoutState,
  createCompletedSession,
  createWorkoutStartState,
  restartTrackedRestState,
  skipTrackedRestState,
} from "../src/features/workouts/js/state.js";
import {
  advanceWorkoutRunner,
  runnerStateFields,
} from "../src/features/workouts/js/runner.js";
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
} from "../src/features/workouts/js/tracking.js";
import {
  getAdjacentWorkoutDates,
  getCalendarMonth,
  groupWorkoutHistoryByDate,
  shiftCalendarMonth,
  sortWorkoutHistory,
} from "../src/features/workouts/js/history.js";
import {
  getDefaultWorkoutPlanDate,
  getWorkoutForDate,
  shiftWorkoutPlanDate,
} from "../src/features/workouts/js/utils.js";
import {
  compareLatestExerciseSessions,
  computeExercisePRs,
  extractTrackedSessions,
  getExercisePerformance,
  getTrackedProgressSummary,
  getWeeklyTrackedAggregates,
  groupTrackedPerformanceByExercise,
} from "../src/features/workouts/js/insights.js";
import {
  getFocusDayKey,
  getFocusMinutesForDay,
  getFocusSessionsForDay,
  getFocusTimeForDay,
  getTodayFocusTime,
  normalizeFocusSessions,
  mergeFocusSessions,
} from "../src/features/focus/js/utils.js";
import {
  createFocusOwnerState,
  deriveFocusElapsedSeconds,
  finishFocusRuntime,
  pauseFocusRuntime,
  refreshFocusRuntime,
  resumeFocusRuntime,
  startFocusRuntime,
} from "../src/features/focus/js/runtime.js";
import { hasMatchingOwnership } from "../src/core/auth/authOwnership.js";
import { createAuthTransitionController } from "../src/core/auth/authTransition.js";
import {
  createSyncSourceState,
  deriveSyncStatus,
  useSync,
} from "../src/ui/useSync.js";
import {
  desktopNavigation,
  mobileMoreNavigation,
  mobilePrimaryNavigation,
} from "../src/app/layout/navigation.js";
import { HABIT_DEFINITIONS } from "../src/features/habits/js/constants.js";
import {
  createHabits,
  normalizeHabitDocument,
  normalizeHabitRecords,
  toggleHabitById,
} from "../src/features/habits/js/habits.js";
import {
  loadHabitDocument,
  saveHabitDocument,
} from "../src/features/habits/js/storage.js";
import { generateReview } from "../src/features/insights/review/js/analyzer.js";
import { computeReviewBreakdown } from "../src/features/insights/review/js/breakdown.js";
import {
  normalizeReview,
  normalizeReviews,
  reconcileReviewHistories,
  resolveReviewConflict,
  reviewsHaveEqualContent,
  upsertReview,
} from "../src/features/insights/review/js/reviews.js";
import { createReviewSyncController } from "../src/features/insights/review/js/sync.js";
import {
  averageChecklistCompletion,
  averageComposureRating,
  countComposureChecks,
  createEmptyComposureChecks,
  filterComposureWeek,
  getComposureWeeklyMetrics,
  normalizeComposureChecks,
  normalizeComposureNote,
  normalizeComposureRating,
  normalizeComposureReviews,
  sortComposureHistory,
  upsertComposureReview,
} from "../src/features/insights/review/js/composure.js";
import {
  createEmptyComposureDocument,
  loadComposureDocument,
  normalizeComposureDocument,
  saveComposureDocument,
} from "../src/features/insights/review/js/composureStorage.js";
import {
  COMPOSURE_CHECKLIST,
  COMPOSURE_STORAGE_KEY,
} from "../src/features/insights/review/js/composureConstants.js";
import {
  isValidSchedule,
  normalizeDailyTasks,
  normalizeSchedule,
  normalizeScheduleItems,
  schedule as defaultSchedule,
} from "../src/features/plan/schedule/js/scheduleDefaults.js";
import {
  createScheduleDraft,
  getScheduleEditorKey,
  prepareScheduleCommit,
  updateScheduleDraft,
} from "../src/features/plan/schedule/js/scheduleEditor.js";
import {
  generateWeeklyInsights,
  getCurrentWeekReviews,
} from "../src/features/insights/analysis/insights.js";
import {
  calculateReminderTime,
  createReminderId,
  createScheduleReminder,
  deriveScheduleReminders,
  isWithinQuietHours,
  planReminders,
} from "../src/features/notifications/js/utils.js";
import { createReminderScheduler } from "../src/features/notifications/js/scheduler.js";
import {
  canUseBrowserNotifications,
  getNotificationPermission,
  requestNotificationPermission,
} from "../src/features/notifications/js/permissions.js";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  REMINDER_GRACE_MS,
} from "../src/features/notifications/js/constants.js";
import {
  DEFAULT_CATEGORIES,
  MONEY_STORAGE_KEY,
} from "../src/features/money/js/constants.js";
import {
  addTransaction as addMoneyTransaction,
  createTransaction,
  deleteTransaction as deleteMoneyTransaction,
  editTransaction as editMoneyTransaction,
  filterTransactions,
  formatInr,
  parseMoneyToMinor,
  sortTransactions,
} from "../src/features/money/js/transactions.js";
import {
  addCustomCategory,
  deleteCustomCategory,
  getCategoryDeletionState,
  normalizeCategories,
} from "../src/features/money/js/categories.js";
import {
  calculateBudgetUsage,
  setMonthlyBudget,
} from "../src/features/money/js/budgets.js";
import {
  addGoal as addMoneyGoal,
  createGoal as createMoneyGoal,
  deleteGoal as deleteMoneyGoal,
  editGoal as editMoneyGoal,
  getGoalProgress,
} from "../src/features/money/js/goals.js";
import {
  aggregateLedger,
  monthlyLedger,
  spendingByCategory,
} from "../src/features/money/js/analytics.js";
import {
  createNextMoneyDocument,
  createEmptyMoneyDocument,
  hasMoneySourceData,
  loadMoneyDocument,
  loadMoneyDocumentForSync,
  normalizeMoneyCloudDocument,
  normalizeMoneyDocument,
  saveMoneyDocument,
  selectMoneySource,
} from "../src/features/money/js/storage.js";
import {
  bindMoneyRecoveryEvents,
  createMoneySyncController,
} from "../src/features/money/js/syncController.js";
import {
  addToolTask,
  completeToolTask,
  createToolTask,
  getLaneTasks,
  getNowTask,
  moveToolTask,
  normalizeToolTasks,
  reorderLaneTask,
} from "../src/features/plan/legacyTools/js/tasks.js";
import {
  addBrainDumpItems,
  createBrainDumpItems,
  promoteBrainDumpItem,
} from "../src/features/plan/legacyTools/js/brainDump.js";
import {
  addBreakdown,
  addBreakdownStep,
  createBreakdown,
  firstIncompleteStep,
  removeBreakdownStep,
  reorderBreakdownStep,
  sendBreakdownStepToLane,
  toggleBreakdownStep,
} from "../src/features/plan/breakdowns/breakdowns.js";
import {
  deriveAwarenessTimer,
  finishAwarenessTimer,
  IDLE_TIMER,
  pauseAwarenessTimer,
  resumeAwarenessTimer,
  startAwarenessTimer,
} from "../src/features/focus/awareness/awarenessTimer.js";
import {
  createEmptyToolsDocument,
  loadToolsDocument,
  normalizeToolsDocument,
  saveToolsDocument,
} from "../src/features/plan/legacyTools/js/storage.js";
import { TOOLS_STORAGE_KEY } from "../src/features/plan/legacyTools/js/constants.js";

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

test("saveData reports serialization failures without replacing stored data", () => {
  memory.clear();
  memory.set("serialization-failure", JSON.stringify({ preserved: true }));
  const circular = {};
  circular.self = circular;
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    assert.equal(saveData("serialization-failure", circular), false);
    assert.deepEqual(loadData("serialization-failure", null), {
      preserved: true,
    });
    assert.equal(saveData("undefined-serialization", undefined), false);
    assert.equal(memory.has("undefined-serialization"), false);
  } finally {
    console.warn = originalWarn;
  }
});

test("saveData reports storage write failures without replacing stored data", () => {
  memory.clear();
  memory.set("quota-failure", JSON.stringify({ preserved: true }));
  const originalSetItem = globalThis.localStorage.setItem;
  const originalWarn = console.warn;
  globalThis.localStorage.setItem = (key, value) => {
    if (key === "quota-failure") throw new Error("Quota exceeded");
    return originalSetItem(key, value);
  };
  console.warn = () => {};

  try {
    assert.equal(saveData("quota-failure", { replacement: true }), false);
    assert.deepEqual(loadData("quota-failure", null), { preserved: true });
  } finally {
    globalThis.localStorage.setItem = originalSetItem;
    console.warn = originalWarn;
  }
});

test("saveData returns false without an owner and true after a valid write", () => {
  memory.clear();
  setStorageOwner(null);

  assert.equal(saveData("echelon_schedule", { owner: "none" }), false);
  assert.equal(memory.has("echelon_schedule"), false);
  assert.equal(saveData("global-test-key", { saved: true }), true);
  assert.deepEqual(loadData("global-test-key", null), { saved: true });
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

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const createAuthTransitionHarness = () => {
  let authState = { user: { uid: "initial" }, loading: false };
  let storageOwner = "initial";
  let syncOwner = "initial";
  const ownerTransitions = [];
  const syncTransitions = [];
  const profiles = new Map();
  const controller = createAuthTransitionController({
    setAuthState: (patch) => {
      authState = { ...authState, ...patch };
    },
    setStorageOwner: (uid) => {
      if (storageOwner !== uid) ownerTransitions.push(uid);
      storageOwner = uid;
    },
    resetSync: (uid) => {
      if (syncOwner !== uid) syncTransitions.push(uid);
      syncOwner = uid;
    },
    initializeProfile: (user) => {
      const pending = profiles.get(user.uid);
      return pending ? pending.promise : Promise.resolve();
    },
  });

  return {
    controller,
    profiles,
    ownerTransitions,
    syncTransitions,
    getState: () => ({ authState, storageOwner }),
    getSyncOwner: () => syncOwner,
  };
};

test("auth A to B transition hides stale A while profile initialization waits", async () => {
  const harness = createAuthTransitionHarness();
  const pendingA = createDeferred();
  const pendingB = createDeferred();
  harness.profiles.set("A", pendingA);
  harness.profiles.set("B", pendingB);

  const operationA = harness.controller.handleAuthChange({ uid: "A" });
  assert.deepEqual(harness.getState(), {
    authState: { user: null, loading: true },
    storageOwner: null,
  });
  const operationB = harness.controller.handleAuthChange({ uid: "B" });
  pendingB.resolve();
  assert.equal(await operationB, true);
  assert.equal(harness.getState().authState.user.uid, "B");
  assert.equal(harness.getState().storageOwner, "B");
  assert.equal(harness.getSyncOwner(), "B");

  pendingA.resolve();
  assert.equal(await operationA, false);
  assert.equal(harness.getState().authState.user.uid, "B");
  assert.equal(harness.getState().storageOwner, "B");
  assert.deepEqual(harness.ownerTransitions, [null, "B"]);
  assert.deepEqual(harness.syncTransitions, [null, "B"]);
});

test("mutations are rejected throughout an auth profile transition", async () => {
  const harness = createAuthTransitionHarness();
  const pending = createDeferred();
  harness.profiles.set("B", pending);

  const operation = harness.controller.handleAuthChange({ uid: "B" });
  const transition = harness.getState();
  assert.equal(
    hasMatchingOwnership(
      transition.authState.user?.uid ?? null,
      transition.storageOwner,
      "B",
    ),
    false,
  );

  pending.resolve();
  await operation;
  const settled = harness.getState();
  assert.equal(
    hasMatchingOwnership(
      settled.authState.user.uid,
      settled.storageOwner,
      "B",
    ),
    true,
  );
});

test("logout invalidates pending profile initialization", async () => {
  const harness = createAuthTransitionHarness();
  const pending = createDeferred();
  harness.profiles.set("A", pending);

  const login = harness.controller.handleAuthChange({ uid: "A" });
  const logout = harness.controller.handleAuthChange(null);
  assert.equal(await logout, true);
  assert.deepEqual(harness.getState(), {
    authState: { user: null, loading: false },
    storageOwner: null,
  });
  assert.equal(harness.getSyncOwner(), null);

  pending.resolve();
  assert.equal(await login, false);
  assert.deepEqual(harness.getState(), {
    authState: { user: null, loading: false },
    storageOwner: null,
  });
  assert.equal(harness.getSyncOwner(), null);
});

test("stale auth callbacks cannot replace a newer settled account", async () => {
  const harness = createAuthTransitionHarness();
  const pendingA = createDeferred();
  harness.profiles.set("A", pendingA);

  const staleA = harness.controller.handleAuthChange({ uid: "A" });
  assert.equal(await harness.controller.handleAuthChange({ uid: "B" }), true);
  pendingA.resolve();
  assert.equal(await staleA, false);
  assert.equal(harness.getState().authState.user.uid, "B");
  assert.equal(harness.getState().storageOwner, "B");
});

test("legacy mutation ownership requires matching auth, storage, and store UIDs", () => {
  assert.equal(hasMatchingOwnership("A", "A", "A"), true);
  assert.equal(hasMatchingOwnership("A", "B", "B"), false);
  assert.equal(hasMatchingOwnership("A", "A", "B"), false);
  assert.equal(hasMatchingOwnership(null, "A", "A"), false);
});

test("sync status derives error, syncing, synced, and idle priority", () => {
  const idle = createSyncSourceState();
  assert.equal(deriveSyncStatus(idle), "idle");
  assert.equal(
    deriveSyncStatus({ ...idle, money: "synced" }),
    "synced",
  );
  assert.equal(
    deriveSyncStatus({ ...idle, money: "syncing", review: "synced" }),
    "syncing",
  );
  assert.equal(
    deriveSyncStatus({ ...idle, money: "error", review: "synced" }),
    "error",
  );
});

test("sync sources update independently without hiding another source error", () => {
  const sync = useSync.getState();
  sync.resetSync("A");

  assert.equal(sync.setSyncStatus("money", "error", "A"), true);
  assert.equal(sync.setSyncStatus("review", "synced", "A"), true);
  assert.deepEqual(useSync.getState().sources, {
    bootstrap: "idle",
    today: "idle",
    schedule: "idle",
    habits: "idle",
    focus: "idle",
    workout: "idle",
    money: "error",
    review: "synced",
  });
  assert.equal(useSync.getState().status, "error");

  useSync.getState().resetSync(null);
});

test("sync ownership reset rejects stale account completions", () => {
  useSync.getState().resetSync("A");
  assert.equal(
    useSync.getState().setSyncStatus("bootstrap", "syncing", "A"),
    true,
  );

  useSync.getState().resetSync(null);
  assert.equal(useSync.getState().status, "idle");
  assert.deepEqual(useSync.getState().sources, createSyncSourceState());

  useSync.getState().resetSync("B");
  assert.equal(
    useSync.getState().setSyncStatus("money", "error", "A"),
    false,
  );
  assert.equal(useSync.getState().ownerUid, "B");
  assert.equal(useSync.getState().status, "idle");

  useSync.getState().resetSync(null);
});

test("navigation registry preserves desktop and five-slot mobile destinations", () => {
  assert.deepEqual(
    desktopNavigation.map(({ id }) => id),
    [
      "today",
      "plan",
      "calendar",
      "habits",
      "workouts",
      "money",
      "insights",
      "settings",
    ],
  );
  assert.deepEqual(
    mobilePrimaryNavigation.map(({ id }) => id),
    ["today", "plan", "calendar", "habits"],
  );
  assert.deepEqual(
    mobileMoreNavigation.map(({ id }) => id),
    ["workouts", "money", "insights", "settings"],
  );
});

test("legacy name-only habits normalize to stable built-in IDs", () => {
  const normalized = normalizeHabitRecords([
    { name: "Exercise", done: true },
    { name: "Focused Work", done: false },
  ]);

  assert.deepEqual(
    normalized.map(({ id }) => id),
    [
      "exercise",
      "focused-work",
      "eat-healthy",
      "no-doom-scrolling",
      "sleep-on-time",
    ],
  );
  assert.equal(normalized.find(({ id }) => id === "exercise").done, true);
  assert.equal(normalized.find(({ id }) => id === "focused-work").done, false);
  assert.equal(normalized.find(({ id }) => id === "eat-healthy").done, false);
});

test("duplicate legacy habits keep the first valid occurrence", () => {
  const normalized = normalizeHabitRecords([
    { name: "Exercise", done: false },
    { name: "Exercise", done: true },
    { id: 123, name: "Eat Healthy", done: true },
    { name: "Eat Healthy", done: true },
    { name: "Focused Work", done: "yes" },
    { name: "Focused Work", done: true },
  ]);

  assert.equal(normalized.find(({ id }) => id === "exercise").done, false);
  assert.equal(normalized.find(({ id }) => id === "eat-healthy").done, true);
  assert.equal(normalized.find(({ id }) => id === "focused-work").done, true);
  assert.equal(normalized.length, HABIT_DEFINITIONS.length);
});

test("malformed and unknown habits cannot become runtime records", () => {
  assert.equal(normalizeHabitRecords([
    null,
    {},
    { name: "Unknown", done: true },
    { id: "custom-habit", name: "Exercise", done: true },
  ]), null);

  const normalized = normalizeHabitRecords([
    { name: "Exercise", done: true },
    { name: "", done: true },
    { done: true },
  ]);
  assert.equal(normalized.length, HABIT_DEFINITIONS.length);
  assert.equal(normalized.filter(({ done }) => done).length, 1);
});

test("habit toggles target one stable ID and reject unknown IDs", () => {
  const habits = createHabits();
  const toggled = toggleHabitById(habits, "focused-work");
  const repeated = toggleHabitById(toggled, "focused-work");

  assert.equal(toggled.find(({ id }) => id === "focused-work").done, true);
  assert.equal(toggled.filter(({ done }) => done).length, 1);
  assert.deepEqual(repeated, habits);
  assert.equal(toggleHabitById(habits, "unknown"), habits);
});

test("duplicate display labels cannot make an ID toggle multiple habits", () => {
  const habits = createHabits().map((habit, index) =>
    index < 2 ? { ...habit, name: "Same visible label" } : habit,
  );
  const toggled = toggleHabitById(habits, "exercise");

  assert.equal(toggled[0].done, true);
  assert.equal(toggled[1].done, false);
  assert.equal(toggled.filter(({ done }) => done).length, 1);
});

test("habit rollover resets completion while preserving stable IDs", () => {
  const previous = normalizeHabitDocument({
    date: "2026-09-16",
    data: [{ name: "Exercise", done: true }],
  }, "2026-09-16");
  const next = createHabits();

  assert.deepEqual(
    previous.data.map(({ id }) => id),
    next.map(({ id }) => id),
  );
  assert.equal(next.every(({ done }) => done === false), true);
  assert.equal(normalizeHabitDocument(previous, "2026-09-17"), null);
});

test("habit reconciliation preserves normalized ID records", () => {
  const local = normalizeHabitDocument({
    date: "2026-09-17",
    revision: 2,
    updatedAt: "2026-09-17T08:00:00.000Z",
    data: [{ id: "exercise", done: true }],
  }, "2026-09-17");
  const cloud = normalizeHabitDocument({
    date: "2026-09-17",
    revision: 1,
    updatedAt: "2026-09-17T07:00:00.000Z",
    data: [{ id: "exercise", done: false }],
  }, "2026-09-17");
  const selectContent = ({ date, data }) => ({ date, data });
  const localWinner = resolveVersionedState(local, cloud, selectContent);
  const cloudWinner = resolveVersionedState(
    local,
    { ...cloud, revision: 3 },
    selectContent,
  );
  const equal = resolveVersionedState(
    local,
    structuredClone(local),
    selectContent,
  );
  const malformedCloud = normalizeHabitDocument({
    date: "2026-09-17",
    revision: 9,
    data: [{ id: "unknown", done: true }],
  }, "2026-09-17");
  const malformedResolution = resolveVersionedState(
    local,
    malformedCloud,
    selectContent,
  );

  assert.equal(localWinner.source, "local");
  assert.equal(localWinner.value.data[0].id, "exercise");
  assert.equal(cloudWinner.source, "cloud");
  assert.equal(equal.source, "equal");
  assert.equal(malformedCloud, null);
  assert.equal(malformedResolution.value, local);
});

test("Habit reconciliation canonicalizes cloud winners and local uploads", async () => {
  const local = normalizeHabitDocument({
    date: "2026-09-17",
    revision: 2,
    updatedAt: "2026-09-17T08:00:00.000Z",
    data: [{ id: "exercise", done: true }],
  }, "2026-09-17");
  const legacyCloud = normalizeHabitDocument({
    date: "2026-09-17",
    revision: 3,
    updatedAt: "2026-09-17T09:00:00.000Z",
    data: [{ name: "Focused Work", done: true }],
  }, "2026-09-17");
  const selectContent = ({ date, data }) => ({ date, data });
  const cloudWinner = await reconcileVersionedState({
    local,
    cloud: legacyCloud,
    selectContent,
    uploadLocal: async () => assert.fail("cloud winner must not upload local"),
  });

  assert.equal(cloudWinner.source, "cloud");
  assert.deepEqual(
    cloudWinner.value.data.map(({ id }) => id),
    HABIT_DEFINITIONS.map(({ id }) => id),
  );
  assert.equal(
    cloudWinner.value.data.find(({ id }) => id === "focused-work").done,
    true,
  );

  let uploaded = null;
  const newerLocal = { ...local, revision: 4 };
  const localWinner = await reconcileVersionedState({
    local: newerLocal,
    cloud: legacyCloud,
    selectContent,
    uploadLocal: async (document) => {
      uploaded = structuredClone(document);
    },
  });

  assert.equal(localWinner.source, "local");
  assert.deepEqual(uploaded, newerLocal);
  assert.equal(uploaded.data.every(({ id }) => typeof id === "string"), true);
});

test("legacy and malformed cloud Habit records normalize safely", () => {
  const legacy = normalizeHabitDocument({
    date: "2026-09-17",
    data: [
      { name: "Sleep On Time", done: true },
      { name: "Sleep On Time", done: false },
      { name: "Unknown", done: true },
    ],
  }, "2026-09-17");

  assert.equal(legacy.data.find(({ id }) => id === "sleep-on-time").done, true);
  assert.equal(legacy.data.length, HABIT_DEFINITIONS.length);
  assert.equal(normalizeHabitDocument({
    date: "2026-09-17",
    data: [{ name: "Unknown", done: true }],
  }, "2026-09-17"), null);
});

test("mounted Habit hydration stays isolated across A to B to A", () => {
  memory.clear();
  setStorageOwner(null);
  const date = "2026-09-17";

  setStorageOwner("habit-user-a");
  saveHabitDocument({
    date,
    data: [{ id: "exercise", done: true }],
    revision: 1,
    updatedAt: "2026-09-17T08:00:00.000Z",
  });
  setStorageOwner("habit-user-b");
  saveHabitDocument({
    date,
    data: [{ id: "focused-work", done: true }],
    revision: 1,
    updatedAt: "2026-09-17T09:00:00.000Z",
  });

  let mounted = null;
  const unsubscribe = subscribeStorageOwner((owner) => {
    mounted = {
      owner,
      habits: loadHabitDocument(date)?.data ?? createHabits(),
    };
  });

  try {
    setStorageOwner(null);
    assert.equal(mounted.owner, null);
    assert.equal(mounted.habits.every(({ done }) => done === false), true);
    setStorageOwner("habit-user-a");
    assert.equal(mounted.owner, "habit-user-a");
    assert.equal(mounted.habits.find(({ id }) => id === "exercise").done, true);
    assert.equal(mounted.habits.find(({ id }) => id === "focused-work").done, false);

    setStorageOwner(null);
    assert.equal(mounted.owner, null);
    assert.equal(mounted.habits.every(({ done }) => done === false), true);
    setStorageOwner("habit-user-b");
    assert.equal(mounted.owner, "habit-user-b");
    assert.equal(mounted.habits.find(({ id }) => id === "exercise").done, false);
    assert.equal(mounted.habits.find(({ id }) => id === "focused-work").done, true);

    setStorageOwner(null);
    setStorageOwner("habit-user-a");
    assert.equal(mounted.habits.find(({ id }) => id === "exercise").done, true);
  } finally {
    unsubscribe();
  }
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
  assert.equal(isValidDayKey("2024-02-29"), true);
  assert.equal(isValidDayKey("2026-02-29"), false);
  assert.equal(isValidDayKey("2026-2-09"), false);
  assert.equal(getToday(parseDayKey("2026-12-31")), "2026-12-31");
  assert.equal(parseDayKey("2026-02-30"), null);
  assert.equal(parseDayKey("2026-13-01"), null);
  assert.equal(getLocalWeekRange("2026-1-02"), null);
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
  assert.deepEqual(
    mergeFocusSessions([session], [session]),
    normalizeFocusSessions([session]),
  );
});

test("Focus attributes legacy ISO records across positive and negative offsets", () => {
  const afterMidnightIndia = {
    task: "India midnight",
    duration: 60,
    date: "2026-01-01T19:15:00.000Z",
  };
  const afterMidnightPacific = {
    task: "Pacific midnight",
    duration: 120,
    date: "2026-01-02T08:15:00.000Z",
  };

  assert.equal(getFocusDayKey(afterMidnightIndia, -330), "2026-01-02");
  assert.equal(getFocusDayKey(afterMidnightPacific, 480), "2026-01-02");
  assert.equal(
    getFocusTimeForDay([afterMidnightIndia], "2026-01-02", {
      timezoneOffsetMinutes: -330,
    }),
    60,
  );
  assert.equal(
    getFocusTimeForDay([afterMidnightPacific], "2026-01-02", {
      timezoneOffsetMinutes: 480,
    }),
    120,
  );
});

test("explicit Focus day keys remain authoritative for new records", () => {
  const session = {
    id: "focus-explicit-day",
    task: "Late work",
    category: "focus",
    duration: 90,
    date: "2026-01-01T19:15:00.000Z",
    dayKey: "2026-01-02",
  };
  const [normalized] = normalizeFocusSessions([session], {
    timezoneOffsetMinutes: 480,
  });

  assert.equal(normalized.dayKey, "2026-01-02");
  assert.deepEqual(
    getFocusSessionsForDay([session], "2026-01-02", {
      timezoneOffsetMinutes: 480,
    }),
    [normalized],
  );
});

test("invalid Focus day keys fall back to timestamp-derived local dates", () => {
  const malformedDay = {
    id: "focus-invalid-day",
    task: "Late work",
    duration: 60,
    date: "2026-01-01T19:15:00.000Z",
    dayKey: "2026-02-30",
  };
  const [normalized] = normalizeFocusSessions([malformedDay], {
    timezoneOffsetMinutes: -330,
  });

  assert.equal(normalized.dayKey, "2026-01-02");
  assert.equal(getFocusDayKey(malformedDay, -330), "2026-01-02");
});

test("Dashboard and Daily Review use the same Focus day aggregation", () => {
  const dayKey = getToday();
  const sessions = [
    {
      id: "focus-shared-aggregation",
      task: "Shared source",
      duration: 125,
      date: new Date().toISOString(),
      dayKey,
    },
  ];
  const dashboardMinutes = Math.floor(getTodayFocusTime(sessions) / 60);
  const review = generateReview({ sessions });
  const breakdown = computeReviewBreakdown({ sessions });

  assert.equal(getFocusMinutesForDay(sessions, dayKey), 2);
  assert.equal(dashboardMinutes, 2);
  assert.equal(review.focusMinutes, 2);
  assert.equal(breakdown.find((item) => item.label === "Focus").value, 1);
});

test("Focus elapsed time is timestamp-derived after delayed display ticks", () => {
  const task = { title: "Deep work", category: "focus" };
  const started = startFocusRuntime(task, 1_000);
  const delayed = refreshFocusRuntime(started, 3_601_000);

  assert.equal(started.seconds, 0);
  assert.equal(delayed.seconds, 3600);
  assert.equal(deriveFocusElapsedSeconds(started, 3_601_000), 3600);
});

test("Focus pause and resume exclude suspended paused time", () => {
  const task = { title: "Deep work", category: "focus" };
  const started = startFocusRuntime(task, 1_000);
  const paused = pauseFocusRuntime(started, 61_000);
  const resumed = resumeFocusRuntime(paused, 3_661_000);
  const finished = finishFocusRuntime(resumed, 3_691_000);

  assert.equal(paused.seconds, 60);
  assert.equal(finished.completed, true);
  assert.equal(finished.duration, 90);
});

test("Focus finish after suspension is accurate and idempotent", () => {
  const task = { title: "Deep work", category: "focus" };
  const started = startFocusRuntime(task, 10_000);
  const first = finishFocusRuntime(started, 610_000);
  const repeated = finishFocusRuntime(first.runtime, 620_000);

  assert.equal(first.duration, 600);
  assert.equal(first.completed, true);
  assert.equal(repeated.completed, false);
  assert.equal(repeated.duration, 0);
});

test("Focus owner changes clear active runtime state", () => {
  const active = {
    owner: "A",
    ...startFocusRuntime({ title: "A task", category: "focus" }, 1_000),
    sessions: [{ id: "A-session" }],
  };
  const switched = createFocusOwnerState("B", [{ id: "B-session" }]);

  assert.equal(active.active, true);
  assert.equal(switched.owner, "B");
  assert.equal(switched.active, false);
  assert.equal(switched.task, null);
  assert.equal(switched.seconds, 0);
  assert.deepEqual(switched.sessions, [{ id: "B-session" }]);
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
  assert.deepEqual(
    mergeWorkoutHistories([session], [null, { workout: "bad" }, session]),
    [session],
  );
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

  assert.equal(getLocalWeekRange("2026-01-01").start, "2025-12-29");
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
  const finishedRunner = advanceWorkoutRunner(
    started.runner,
    started.workout,
    new Date(startedAt.getTime() + 40_000),
  );
  started = { ...started, ...runnerStateFields(finishedRunner) };

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
    new URL("../src/features/workouts/js/store.js", import.meta.url),
    "utf8",
  );
  const storageSource = readFileSync(
    new URL("../src/features/workouts/js/workoutStorage.js", import.meta.url),
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

test("analytics sanitizes partial review histories without NaN or Infinity", () => {
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
    reconcileReviewHistories([localReview], [cloudReview, null]).history,
    [localReview],
  );
  assert.equal(normalizeSchedule([{ id: 1 }]), defaultSchedule);
  assert.equal(normalizeDailyTasks([{ id: 1 }]), null);

  const validTasks = defaultSchedule.map((task) => ({ ...task, done: "yes" }));
  assert.equal(normalizeDailyTasks(validTasks).every((task) => !task.done), true);
});

const reviewRecord = (date, score, updatedAt, extra = {}) => ({
  date,
  score,
  wins: [],
  improvements: [],
  focusMinutes: 0,
  workoutCompleted: false,
  workoutRequired: false,
  ...(updatedAt ? { updatedAt } : {}),
  ...extra,
});

test("Analytics current local week uses Monday through Sunday boundaries", () => {
  assert.deepEqual(
    getLocalWeekRange(new Date(2026, 8, 16, 12, 0)),
    { start: "2026-09-14", end: "2026-09-20" },
  );
  assert.deepEqual(
    getLocalWeekRange(new Date(2026, 8, 14, 0, 0)),
    { start: "2026-09-14", end: "2026-09-20" },
  );
  assert.deepEqual(
    getLocalWeekRange(new Date(2026, 8, 20, 23, 59)),
    { start: "2026-09-14", end: "2026-09-20" },
  );
});

test("Analytics local week boundaries cross months, years, and leap days", () => {
  assert.deepEqual(
    getLocalWeekRange(new Date(2026, 2, 1, 12, 0)),
    { start: "2026-02-23", end: "2026-03-01" },
  );
  assert.deepEqual(
    getLocalWeekRange(new Date(2027, 0, 1, 12, 0)),
    { start: "2026-12-28", end: "2027-01-03" },
  );
  assert.deepEqual(
    getLocalWeekRange(new Date(2024, 1, 29, 12, 0)),
    { start: "2024-02-26", end: "2024-03-03" },
  );
});

test("Weekly Intelligence uses sparse current-week reviews without older substitution", () => {
  const reviews = [
    reviewRecord("2026-09-13", 100, "2026-09-13T12:00:00.000Z", { focusMinutes: 500 }),
    reviewRecord("2026-09-14", 50, "2026-09-14T12:00:00.000Z", { focusMinutes: 30 }),
    reviewRecord("2026-09-16", 70, "2026-09-16T12:00:00.000Z"),
    reviewRecord("2026-09-19", 90, "2026-09-19T12:00:00.000Z", { focusMinutes: 60 }),
  ];
  const now = new Date(2026, 8, 16, 12, 0);

  assert.deepEqual(
    getCurrentWeekReviews(reviews, now).map((review) => review.date),
    ["2026-09-14", "2026-09-16", "2026-09-19"],
  );
  assert.deepEqual(generateWeeklyInsights(reviews, now), {
    average: 70,
    best: normalizeReview(reviews[3]),
    worst: normalizeReview(reviews[1]),
    totalFocus: 90,
  });
});

test("Weekly Intelligence consumes normalized unique Review dates", () => {
  const older = reviewRecord("2026-09-16", 30, "2026-09-16T10:00:00.000Z");
  const newer = reviewRecord("2026-09-16", 80, "2026-09-16T11:00:00.000Z", { unknown: true });
  const reviews = [
    older,
    { date: "not-a-date", score: 100 },
    { ...newer, score: Number.NaN, updatedAt: "2027-01-01T00:00:00.000Z" },
    newer,
  ];
  const insight = generateWeeklyInsights(reviews, new Date(2026, 8, 16, 12, 0));
  const normalized = getCurrentWeekReviews(
    reviews,
    new Date(2026, 8, 16, 12, 0),
  );

  assert.equal(insight.average, 80);
  assert.equal(insight.totalFocus, 0);
  assert.equal(insight.best, null);
  assert.equal(insight.worst, null);
  assert.equal(normalized[0].score, 80);
  assert.equal("unknown" in normalized[0], false);
  assert.equal(
    Object.values(insight).some((value) => typeof value === "number" && !Number.isFinite(value)),
    false,
  );
});

test("retired progress history remains registered but no longer drives Analytics", () => {
  const analyticsPage = readFileSync(
    new URL("../src/features/insights/Analysis.jsx", import.meta.url),
    "utf8",
  );
  const storageSource = readFileSync(
    new URL("../src/shared/storage.js", import.meta.url),
    "utf8",
  );
  assert.equal(analyticsPage.includes("echelon_history"), false);
  assert.equal(storageSource.includes('"echelon_history"'), true);
});

test("Daily Review normalization enforces its record and breakdown contract", () => {
  const valid = reviewRecord("2026-09-17", 75, "2026-09-17T12:00:00.000Z", {
    breakdown: [
      { label: "Workout", value: 0 },
      { label: "Tasks", value: 80 },
      { label: "Focus", value: 70 },
      { label: "Habits", value: 90 },
    ],
    ignored: "not persisted",
  });
  const normalized = normalizeReview(valid);

  assert.deepEqual(normalized.breakdown.map((item) => item.label), [
    "Tasks",
    "Habits",
    "Focus",
    "Workout",
  ]);
  assert.equal("ignored" in normalized, false);
  assert.equal(normalizeReview({ ...valid, score: Infinity }), null);
  assert.equal(normalizeReview({ ...valid, date: "2026-02-30" }), null);
  assert.equal(normalizeReview({ ...valid, breakdown: [{ label: "Tasks", value: 50 }] }), null);
});

test("Daily Review duplicate dates keep the newest valid record deterministically", () => {
  const older = reviewRecord("2026-09-17", 60, "2026-09-17T10:00:00.000Z");
  const newer = reviewRecord("2026-09-17", 80, "2026-09-17T11:00:00.000Z");
  const invalidNewer = { ...newer, score: Number.NaN, updatedAt: "2027-01-01T00:00:00.000Z" };

  assert.deepEqual(normalizeReviews([older, invalidNewer, newer]), [newer]);
  assert.deepEqual(normalizeReviews([newer, older]), [newer]);
  assert.deepEqual(normalizeReviews([{ ...older, updatedAt: undefined }, { ...newer, updatedAt: undefined }]), [
    { ...older, updatedAt: undefined },
  ].map((item) => normalizeReview(item)));
});

test("Daily Review same-date upsert is idempotent and advances freshness only on change", () => {
  const existing = reviewRecord("2026-09-17", 60, "2026-09-17T10:00:00.000Z");
  const unchanged = upsertReview([existing], { ...existing, updatedAt: undefined }, new Date("2026-09-17T11:00:00.000Z"));
  const changed = upsertReview([existing], { ...existing, score: 80, updatedAt: undefined }, new Date("2026-09-17T12:00:00.000Z"));

  assert.equal(unchanged.changed, false);
  assert.deepEqual(unchanged.history, [existing]);
  assert.equal(changed.changed, true);
  assert.equal(changed.history.length, 1);
  assert.equal(changed.review.score, 80);
  assert.equal(changed.review.updatedAt, "2026-09-17T12:00:00.000Z");

  const clockRollback = upsertReview(
    changed.history,
    { ...changed.review, score: 90, updatedAt: undefined },
    new Date("2026-09-17T11:00:00.000Z"),
  );
  assert.equal(clockRollback.review.updatedAt, "2026-09-17T12:00:00.001Z");
});

test("Daily Review conflicts use valid freshness and favor local ambiguous ties", () => {
  const localOlder = reviewRecord("2026-09-17", 60, "2026-09-17T10:00:00.000Z");
  const cloudNewer = reviewRecord("2026-09-17", 80, "2026-09-17T11:00:00.000Z");
  assert.deepEqual(resolveReviewConflict(localOlder, cloudNewer), cloudNewer);
  assert.deepEqual(resolveReviewConflict(cloudNewer, localOlder), cloudNewer);

  const localLegacy = reviewRecord("2026-09-18", 70);
  const cloudLegacy = reviewRecord("2026-09-18", 30);
  assert.deepEqual(resolveReviewConflict(localLegacy, cloudLegacy), localLegacy);
  assert.equal(reviewsHaveEqualContent(localOlder, { ...localOlder, updatedAt: "2026-09-17T13:00:00.000Z" }), true);
});

test("Daily Review reconciliation preserves local history and uploads local conflict winners", () => {
  const localOnly = reviewRecord("2026-09-15", 55, "2026-09-15T10:00:00.000Z");
  const localWinner = reviewRecord("2026-09-16", 85, "2026-09-16T12:00:00.000Z");
  const cloudLoser = reviewRecord("2026-09-16", 45, "2026-09-16T11:00:00.000Z");
  const cloudOnly = reviewRecord("2026-09-17", 75, "2026-09-17T10:00:00.000Z");
  const result = reconcileReviewHistories(
    [localOnly, localWinner, { date: "bad", score: 100 }],
    [cloudLoser, cloudOnly, { ...cloudOnly, score: Infinity }],
  );

  assert.deepEqual(result.history.map((review) => review.date), [
    "2026-09-15",
    "2026-09-16",
    "2026-09-17",
  ]);
  assert.deepEqual(result.uploads, [localWinner]);
});

test("repeated Daily Review reconciliation preserves local-only dates without backfill", async () => {
  const localOnly = reviewRecord("2026-09-15", 55, "2026-09-15T10:00:00.000Z");
  const cloudOnly = reviewRecord("2026-09-16", 75, "2026-09-16T10:00:00.000Z");
  const harness = createReviewSyncHarness({ cloud: [cloudOnly] });
  harness.state.histories["user-a"] = [localOnly];

  assert.equal(await harness.controller.activate("user-a"), true);
  assert.equal(await harness.controller.activate("user-a"), true);
  assert.deepEqual(harness.state.histories["user-a"], [localOnly, cloudOnly]);
  assert.deepEqual(harness.state.writes, []);
});

test("equal Daily Review content with different timestamps is a reconciliation no-op", () => {
  const local = reviewRecord("2026-09-17", 80, "2026-09-17T10:00:00.000Z");
  const cloud = { ...local, updatedAt: "2026-09-17T12:00:00.000Z" };
  const result = reconcileReviewHistories([local], [cloud]);

  assert.deepEqual(result.history, [local]);
  assert.deepEqual(result.uploads, []);
});

test("Daily Review identity follows adjacent local calendar dates", () => {
  const beforeMidnight = getToday(new Date(2026, 8, 17, 23, 59, 59));
  const afterMidnight = getToday(new Date(2026, 8, 18, 0, 0, 1));
  assert.equal(isValidDayKey(beforeMidnight), true);
  assert.equal(isValidDayKey(afterMidnight), true);
  assert.notEqual(beforeMidnight, afterMidnight);

  const first = upsertReview([], reviewRecord(beforeMidnight, 60), new Date("2026-09-17T18:29:59.000Z"));
  const second = upsertReview(first.history, reviewRecord(afterMidnight, 70), new Date("2026-09-17T18:30:01.000Z"));
  assert.equal(second.history.length, 2);
});

function createReviewSyncHarness({
  cloud = [],
  loadError = null,
  writeError = null,
  saveResult = null,
} = {}) {
  const state = {
    context: { authUid: "user-a", storageOwner: "user-a", storeOwner: "user-a" },
    histories: { "user-a": [] },
    cloud: { "user-a": cloud },
    statuses: [],
    writes: [],
    loadError,
    writeError,
    rejectApply: false,
  };
  const controller = createReviewSyncController({
    getContext: () => state.context,
    getLocalHistory: (uid) => state.histories[uid] ?? [],
    applyHistory: (uid, history) => {
      if (state.context.authUid !== uid || state.context.storageOwner !== uid || state.context.storeOwner !== uid) return false;
      if (state.rejectApply) return false;
      state.histories[uid] = history;
      return true;
    },
    setStatus: (uid, status) => {
      if (state.context.authUid !== uid || state.context.storageOwner !== uid || state.context.storeOwner !== uid) return false;
      state.statuses.push({ uid, status });
      return true;
    },
    loadCloudHistory: async (uid) => {
      if (state.loadError) throw state.loadError;
      return state.cloud[uid] ?? [];
    },
    saveCloudReview: async (uid, review) => {
      state.writes.push({ uid, review });
      if (state.writeError) throw state.writeError;
      if (saveResult) return saveResult(uid, review);
      state.cloud[uid] = reconcileReviewHistories(state.cloud[uid] ?? [], [review]).history;
      return { written: true, review };
    },
    now: () => new Date("2026-09-17T12:00:00.000Z"),
  });
  return { state, controller };
}

test("Daily Review sync applies newer cloud and uploads newer local conflicts", async () => {
  const cloudNewer = reviewRecord("2026-09-16", 80, "2026-09-16T12:00:00.000Z");
  const harness = createReviewSyncHarness({ cloud: [cloudNewer] });
  harness.state.histories["user-a"] = [reviewRecord("2026-09-16", 40, "2026-09-16T11:00:00.000Z")];
  assert.equal(await harness.controller.activate("user-a"), true);
  assert.deepEqual(harness.state.histories["user-a"], [cloudNewer]);
  assert.equal(harness.state.writes.length, 0);

  assert.equal(
    await harness.controller.save(
      "user-a",
      reviewRecord("2026-09-16", 40, "2026-09-16T11:00:00.000Z"),
    ),
    true,
  );
  assert.deepEqual(harness.state.histories["user-a"], [cloudNewer]);
  assert.equal(harness.state.writes.length, 0);

  const second = createReviewSyncHarness({ cloud: [reviewRecord("2026-09-16", 40, "2026-09-16T11:00:00.000Z")] });
  const localNewer = reviewRecord("2026-09-16", 80, "2026-09-16T12:00:00.000Z");
  second.state.histories["user-a"] = [localNewer];
  assert.equal(await second.controller.activate("user-a"), true);
  assert.deepEqual(second.state.writes, [{ uid: "user-a", review: localNewer }]);
});

test("Daily Review failed reads and writes never report synced", async () => {
  const failedRead = createReviewSyncHarness({ loadError: new Error("read failed") });
  const failedActivation = failedRead.controller.activate("user-a");
  const failedLocalSave = failedRead.controller.save(
    "user-a",
    reviewRecord("2026-09-17", 65),
  );
  assert.equal(await failedActivation, false);
  assert.equal(await failedLocalSave, false);
  assert.equal(failedRead.state.histories["user-a"].length, 1);
  assert.equal(failedRead.state.writes.length, 0);
  assert.equal(failedRead.state.statuses.at(-1).status, "error");

  const failedWrite = createReviewSyncHarness({ writeError: new Error("write failed") });
  assert.equal(await failedWrite.controller.activate("user-a"), true);
  assert.equal(await failedWrite.controller.save("user-a", reviewRecord("2026-09-17", 75)), false);
  assert.equal(failedWrite.state.histories["user-a"].length, 1);
  assert.equal(failedWrite.state.statuses.at(-1).status, "error");
});

test("Daily Review recovers from a failed read before allowing cloud writes", async () => {
  const cloudReview = reviewRecord(
    "2026-09-16",
    90,
    "2026-09-16T12:00:00.000Z",
  );
  const harness = createReviewSyncHarness({ loadError: new Error("offline") });
  harness.state.histories["user-a"] = [
    reviewRecord("2026-09-15", 60, "2026-09-15T12:00:00.000Z"),
  ];

  assert.equal(await harness.controller.activate("user-a"), false);
  assert.equal(
    await harness.controller.save("user-a", reviewRecord("2026-09-17", 70)),
    false,
  );
  assert.equal(harness.state.writes.length, 0);

  harness.state.loadError = null;
  harness.state.cloud["user-a"] = [cloudReview];
  assert.equal(await harness.controller.activate("user-a"), true);
  assert.deepEqual(
    harness.state.histories["user-a"].map((review) => review.date),
    ["2026-09-15", "2026-09-16", "2026-09-17"],
  );
  assert.equal(harness.state.statuses.at(-1).status, "synced");
});

test("failed Daily Review reconciliation apply cannot unlock later cloud writes", async () => {
  const local = reviewRecord(
    "2026-09-17",
    70,
    "2026-09-17T11:00:00.000Z",
  );
  const harness = createReviewSyncHarness({
    cloud: [reviewRecord("2026-09-16", 80, "2026-09-16T11:00:00.000Z")],
  });
  harness.state.histories["user-a"] = [local];
  harness.state.rejectApply = true;

  assert.equal(await harness.controller.activate("user-a"), false);
  assert.equal(await harness.controller.save("user-a", local), false);
  assert.deepEqual(harness.state.writes, []);
  assert.equal(harness.state.statuses.at(-1).status, "error");
});

test("Daily Review write reconciliation accepts a concurrently newer cloud record", async () => {
  const newerRemote = reviewRecord(
    "2026-09-17",
    95,
    "2026-09-17T13:00:00.000Z",
  );
  const harness = createReviewSyncHarness({
    saveResult: () => ({ written: false, review: newerRemote }),
  });
  assert.equal(await harness.controller.activate("user-a"), true);
  assert.equal(
    await harness.controller.save("user-a", reviewRecord("2026-09-17", 70)),
    true,
  );
  assert.deepEqual(harness.state.histories["user-a"], [newerRemote]);
  assert.equal(harness.state.statuses.at(-1).status, "synced");
});

test("Daily Review sync rejects pre-auth and mismatched-owner operations", async () => {
  const harness = createReviewSyncHarness();
  harness.state.context = { authUid: null, storageOwner: null, storeOwner: null };
  assert.equal(await harness.controller.activate("user-a"), false);
  assert.equal(
    await harness.controller.save("user-a", reviewRecord("2026-09-17", 50)),
    false,
  );
  assert.deepEqual(harness.state.histories["user-a"], []);
  assert.deepEqual(harness.state.writes, []);
});

test("Daily Review stale User A cloud responses are discarded after switching to B", async () => {
  let resolveUserA;
  const state = {
    context: { authUid: "user-a", storageOwner: "user-a", storeOwner: "user-a" },
    histories: { "user-a": [], "user-b": [] },
    statuses: [],
  };
  const controller = createReviewSyncController({
    getContext: () => state.context,
    getLocalHistory: (uid) => state.histories[uid],
    applyHistory: (uid, history) => {
      if (state.context.authUid !== uid || state.context.storageOwner !== uid || state.context.storeOwner !== uid) return false;
      state.histories[uid] = history;
      return true;
    },
    setStatus: (uid, status) => state.statuses.push({ uid, status }),
    loadCloudHistory: (uid) => uid === "user-a"
      ? new Promise((resolve) => { resolveUserA = resolve; })
      : Promise.resolve([reviewRecord("2026-09-17", 90)]),
    saveCloudReview: async () => {},
  });

  const pendingA = controller.activate("user-a");
  await Promise.resolve();
  controller.deactivate("user-a");
  state.context = { authUid: "user-b", storageOwner: "user-b", storeOwner: "user-b" };
  const pendingB = controller.activate("user-b");
  resolveUserA([reviewRecord("2026-09-17", 10)]);
  assert.equal(await pendingA, false);
  assert.equal(await pendingB, true);
  assert.deepEqual(state.histories["user-a"], []);
  assert.equal(state.histories["user-b"][0].score, 90);
});

test("Daily Review stale User A transaction completion cannot affect User B", async () => {
  let resolveWrite;
  let signalWriteStarted;
  const writeStarted = new Promise((resolve) => {
    signalWriteStarted = resolve;
  });
  const harness = createReviewSyncHarness({
    saveResult: () => new Promise((resolve) => {
      resolveWrite = resolve;
      signalWriteStarted();
    }),
  });
  assert.equal(await harness.controller.activate("user-a"), true);
  const pendingWrite = harness.controller.save(
    "user-a",
    reviewRecord("2026-09-17", 70),
  );
  await writeStarted;

  harness.controller.deactivate("user-a");
  harness.state.context = {
    authUid: "user-b",
    storageOwner: "user-b",
    storeOwner: "user-b",
  };
  harness.state.histories["user-b"] = [];
  harness.state.cloud["user-b"] = [];
  resolveWrite({
    written: true,
    review: reviewRecord("2026-09-17", 70, "2026-09-17T12:00:00.000Z"),
  });

  assert.equal(await pendingWrite, false);
  assert.deepEqual(harness.state.histories["user-b"], []);
  assert.equal(
    harness.state.statuses.some(
      ({ uid, status }) => uid === "user-b" && status === "synced",
    ),
    false,
  );
});

test("Daily Review mounted sync lifecycle restores isolated A and B histories", async () => {
  const harness = createReviewSyncHarness();
  await harness.controller.activate("user-a");
  await harness.controller.save("user-a", reviewRecord("2026-09-17", 70));
  harness.controller.deactivate("user-a");

  harness.state.context = { authUid: "user-b", storageOwner: "user-b", storeOwner: "user-b" };
  harness.state.histories["user-b"] = [];
  harness.state.cloud["user-b"] = [];
  await harness.controller.activate("user-b");
  await harness.controller.save("user-b", reviewRecord("2026-09-17", 30));
  harness.controller.deactivate("user-b");

  harness.state.context = { authUid: "user-a", storageOwner: "user-a", storeOwner: "user-a" };
  await harness.controller.activate("user-a");
  assert.equal(harness.state.histories["user-a"][0].score, 70);
  assert.equal(harness.state.histories["user-b"][0].score, 30);
});

test("schedule normalization keeps valid siblings and rejects malformed items", () => {
  const valid = { ...defaultSchedule[0] };
  const unknownCategory = {
    ...defaultSchedule[1],
    category: "unknown",
  };
  const blankTitle = { ...defaultSchedule[2], title: "   " };
  const blankId = { ...defaultSchedule[3], id: "   " };
  const invertedTime = {
    ...defaultSchedule[4],
    start: "09:00",
    end: "08:00",
  };

  assert.deepEqual(normalizeScheduleItems([
    unknownCategory,
    valid,
    blankTitle,
    blankId,
    invertedTime,
  ]), [valid]);
  assert.equal(isValidSchedule([unknownCategory, valid]), false);
});

test("schedule normalization keeps the first unique ID deterministically", () => {
  const first = { ...defaultSchedule[0], title: "First" };
  const duplicate = { ...defaultSchedule[1], id: String(first.id) };
  const normalized = normalizeScheduleItems([duplicate, first]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].title, duplicate.title);
});

test("a malformed duplicate cannot block a later valid schedule item", () => {
  const valid = { ...defaultSchedule[0] };
  const malformed = { ...valid, title: "   " };

  assert.deepEqual(normalizeScheduleItems([malformed, valid]), [valid]);
});

test("schedule normalization sorts valid items without mutating the source", () => {
  const later = { ...defaultSchedule[5] };
  const earlier = { ...defaultSchedule[0] };
  const source = [later, earlier];
  const normalized = normalizeScheduleItems(source);

  assert.deepEqual(normalized.map(({ id }) => id), [earlier.id, later.id]);
  assert.deepEqual(source.map(({ id }) => id), [later.id, earlier.id]);
  assert.equal(isValidSchedule(source), true);
});

test("schedule draft edits remain isolated until one accepted apply", () => {
  const committed = defaultSchedule.map((task) => ({ ...task }));
  const draft = createScheduleDraft(committed);
  const partial = updateScheduleDraft(draft, committed[0].id, { start: "0" });
  let persistCount = 0;
  let notificationRecomputes = 0;

  assert.equal(committed[0].start, "05:30");
  assert.equal(draft[0].start, "05:30");
  assert.equal(partial[0].start, "0");
  assert.equal(persistCount, 0);
  assert.equal(notificationRecomputes, 0);
  assert.equal(prepareScheduleCommit(partial), null);
  assert.equal(persistCount, 0);
  assert.equal(notificationRecomputes, 0);

  const prepared = prepareScheduleCommit(draft);
  if (prepared) {
    persistCount += 1;
    notificationRecomputes += 1;
  }
  assert.equal(persistCount, 1);
  assert.equal(notificationRecomputes, 1);
});

test("schedule draft reload and cancel restore the committed schedule", () => {
  const committed = defaultSchedule.map((task) => ({ ...task }));
  const partial = updateScheduleDraft(
    createScheduleDraft(committed),
    committed[0].id,
    { start: "0" },
  );

  assert.notDeepEqual(partial, committed);
  assert.deepEqual(createScheduleDraft(committed), committed);
});

test("schedule editor ownership and committed versions invalidate dirty drafts", () => {
  const userA = getScheduleEditorKey({
    owner: "user-a",
    revision: 2,
    updatedAt: "2026-09-17T10:00:00.000Z",
  });
  const userB = getScheduleEditorKey({
    owner: "user-b",
    revision: 2,
    updatedAt: "2026-09-17T10:00:00.000Z",
  });
  const userBUpdated = getScheduleEditorKey({
    owner: "user-b",
    revision: 3,
    updatedAt: "2026-09-17T10:01:00.000Z",
  });

  assert.notEqual(userA, userB);
  assert.notEqual(userB, userBUpdated);
});

test("schedule apply does not claim success when persistence rejects commit", () => {
  let attempts = 0;
  const prepared = prepareScheduleCommit(createScheduleDraft(defaultSchedule));
  const applied = prepared && (() => {
    attempts += 1;
    return false;
  })();

  assert.equal(attempts, 1);
  assert.equal(applied, false);
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

  assert.equal(calculateReminderTime("2026-1-02", "20:00", 10), null);
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

test("failed terminal persistence prevents delivery without scheduler retry", () => {
  const reminder = createScheduleReminder(scheduleTask, "2026-01-02", 10);
  const fake = createFakeScheduler();
  let terminalWrites = 0;
  let deliveries = 0;

  fake.scheduler.reconcile([reminder], () => {
    terminalWrites += 1;
    const persisted = false;
    if (!persisted) return;
    deliveries += 1;
  });

  const scheduled = [...fake.callbacks.values()][0];
  scheduled.callback();

  assert.equal(terminalWrites, 1);
  assert.equal(deliveries, 0);
  assert.deepEqual(fake.scheduler.getScheduledIds(), []);
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

const moneyTransaction = ({
  id,
  type = "expense",
  amount = "100",
  categoryId = type === "expense" ? "expense:food" : "income:salary",
  date = "2026-09-14",
  now = "2026-09-14T10:00:00.000Z",
  description = "",
} = {}) =>
  createTransaction(
    { type, amount, categoryId, date, description, recurring: false },
    DEFAULT_CATEGORIES,
    { id, now },
  );

test("money parsing uses exact integer minor units", () => {
  assert.equal(parseMoneyToMinor("0.1"), 10);
  assert.equal(parseMoneyToMinor("10.01"), 1001);
  assert.equal(parseMoneyToMinor("999.99"), 99999);
  assert.equal(parseMoneyToMinor("337.50"), 33750);
  assert.equal(parseMoneyToMinor("0.01"), 1);
  assert.equal(parseMoneyToMinor("337"), 33700);
  assert.equal(parseMoneyToMinor("90071992547409.91"), Number.MAX_SAFE_INTEGER);
  assert.equal(parseMoneyToMinor("90071992547409.92"), null);
  assert.equal(parseMoneyToMinor("1.234"), null);
  assert.equal(parseMoneyToMinor("0"), 0);
  assert.equal(parseMoneyToMinor("-2"), null);
  assert.equal(parseMoneyToMinor(Number.NaN), null);
  assert.equal(parseMoneyToMinor(Number.POSITIVE_INFINITY), null);
  assert.equal(formatInr(33750).includes("337.50"), true);
});

test("transaction creation validates required fields and positive amounts", () => {
  const transaction = moneyTransaction({
    id: "transaction:one",
    amount: "337.50",
    description: "Lunch",
  });

  assert.equal(transaction.amountMinor, 33750);
  assert.equal(transaction.description, "Lunch");
  assert.equal(moneyTransaction({ id: "bad", amount: "0" }), null);
  assert.equal(moneyTransaction({ id: "bad type", amount: "1" }), null);
  assert.equal(moneyTransaction({ id: "bad-date", date: "2026-02-30" }), null);
  assert.equal(
    moneyTransaction({
      id: "bad-category",
      type: "income",
      categoryId: "expense:food",
    }),
    null,
  );
});

test("transaction edits reject an incompatible category when type changes", () => {
  const original = moneyTransaction({ id: "transaction:type-change" });
  const rejected = editMoneyTransaction(
    [original],
    original.id,
    { type: "income" },
    DEFAULT_CATEGORIES,
    new Date("2026-09-14T11:00:00.000Z"),
  );
  const accepted = editMoneyTransaction(
    [original],
    original.id,
    { type: "income", categoryId: "income:salary" },
    DEFAULT_CATEGORIES,
    new Date("2026-09-14T11:00:00.000Z"),
  );

  assert.equal(rejected[0], original);
  assert.equal(accepted[0].id, original.id);
  assert.equal(accepted[0].type, "income");
  assert.equal(accepted[0].categoryId, "income:salary");
});

test("transaction add is idempotent and edit preserves identity", () => {
  const original = moneyTransaction({ id: "transaction:stable", amount: "10" });
  const once = addMoneyTransaction([], original);
  const repeated = addMoneyTransaction(once, original);
  const edited = editMoneyTransaction(
    repeated,
    original.id,
    { amount: "12.75", description: "Updated" },
    DEFAULT_CATEGORIES,
    new Date("2026-09-14T11:00:00.000Z"),
  );

  assert.equal(repeated, once);
  assert.equal(edited[0].id, original.id);
  assert.equal(edited[0].createdAt, original.createdAt);
  assert.equal(edited[0].amountMinor, 1275);
  assert.equal(edited[0].description, "Updated");
});

test("transaction deletion removes only the requested identity", () => {
  const first = moneyTransaction({ id: "transaction:first" });
  const second = moneyTransaction({ id: "transaction:second" });
  const transactions = [first, second];

  assert.deepEqual(deleteMoneyTransaction(transactions, first.id), [second]);
  assert.equal(deleteMoneyTransaction(transactions, "missing"), transactions);
});

test("ledger aggregates income and expense without signed stored amounts", () => {
  const transactions = [
    moneyTransaction({ id: "income:one", type: "income", amount: "7000" }),
    moneyTransaction({ id: "expense:one", amount: "2380" }),
  ];

  assert.deepEqual(aggregateLedger(transactions), {
    incomeMinor: 700000,
    expenseMinor: 238000,
    netMinor: 462000,
  });
  assert.equal(transactions.every((item) => item.amountMinor > 0), true);
});

test("money month filtering and analytics cross year boundaries", () => {
  const transactions = [
    moneyTransaction({ id: "december", date: "2025-12-31", amount: "10" }),
    moneyTransaction({ id: "january", date: "2026-01-01", amount: "20" }),
    moneyTransaction({
      id: "january-income",
      type: "income",
      date: "2026-01-02",
      amount: "50",
    }),
  ];

  assert.deepEqual(
    filterTransactions(transactions, { month: "2025-12" }).map(
      (item) => item.id,
    ),
    ["december"],
  );
  assert.deepEqual(monthlyLedger(transactions), [
    {
      month: "2025-12",
      incomeMinor: 0,
      expenseMinor: 1000,
      netMinor: -1000,
    },
    {
      month: "2026-01",
      incomeMinor: 5000,
      expenseMinor: 2000,
      netMinor: 3000,
    },
  ]);
});

test("category totals and filters use transaction source data", () => {
  const transactions = [
    moneyTransaction({ id: "food-one", amount: "10" }),
    moneyTransaction({ id: "food-two", amount: "5.50" }),
    moneyTransaction({
      id: "transport",
      amount: "20",
      categoryId: "expense:transport",
    }),
  ];

  assert.deepEqual(spendingByCategory(transactions), [
    { categoryId: "expense:transport", amountMinor: 2000 },
    { categoryId: "expense:food", amountMinor: 1550 },
  ]);
  assert.equal(
    filterTransactions(transactions, { categoryId: "expense:food" }).length,
    2,
  );
});

test("custom category deletion is blocked while referenced", () => {
  const categories = addCustomCategory(
    normalizeCategories([]),
    { name: "Coffee", type: "expense" },
    "category:coffee",
  );
  const transaction = createTransaction(
    {
      type: "expense",
      amount: "100",
      categoryId: "category:coffee",
      date: "2026-09-14",
    },
    categories,
    { id: "coffee-transaction", now: "2026-09-14T10:00:00.000Z" },
  );

  assert.equal(categories.at(-1).name, "Coffee");
  assert.equal(
    getCategoryDeletionState("category:coffee", [transaction]).allowed,
    false,
  );
  assert.equal(
    deleteCustomCategory(categories, "category:coffee", [transaction], []),
    categories,
  );
  assert.equal(
    deleteCustomCategory(categories, "category:coffee", [], []).some(
      (item) => item.id === "category:coffee",
    ),
    false,
  );
});

test("monthly budgets derive normal, warning, and over states", () => {
  const budgets = setMonthlyBudget(
    [],
    "expense:food",
    "100",
    DEFAULT_CATEGORIES,
  );
  const atSeventy = moneyTransaction({ id: "seventy", amount: "70" });
  const atNinety = moneyTransaction({ id: "ninety", amount: "90" });
  const over = moneyTransaction({ id: "over", amount: "110" });

  assert.equal(calculateBudgetUsage(budgets[0], [atSeventy], "2026-09").status, "normal");
  assert.equal(calculateBudgetUsage(budgets[0], [atNinety], "2026-09").status, "warning");
  const overUsage = calculateBudgetUsage(budgets[0], [over], "2026-09");
  assert.equal(overUsage.status, "over");
  assert.equal(overUsage.remainingMinor, -1000);
});

test("budget thresholds and transaction edits are derived at exact boundaries", () => {
  const budgets = setMonthlyBudget([], "expense:food", "100", DEFAULT_CATEGORIES);
  const budget = budgets[0];
  const usage = (amount) =>
    calculateBudgetUsage(
      budget,
      [moneyTransaction({ id: `transaction:${amount.replace(".", "-")}`, amount })],
      "2026-09",
    );

  assert.equal(usage("79.99").status, "normal");
  assert.equal(usage("80").status, "warning");
  assert.equal(usage("100").status, "warning");
  assert.equal(usage("100.01").status, "over");
  assert.equal(setMonthlyBudget(budgets, "expense:food", "0", DEFAULT_CATEGORIES), budgets);
  assert.equal(setMonthlyBudget(budgets, "income:salary", "100", DEFAULT_CATEGORIES), budgets);

  const original = moneyTransaction({ id: "transaction:budget-edit", amount: "80" });
  const edited = editMoneyTransaction(
    [original],
    original.id,
    { amount: "20" },
    DEFAULT_CATEGORIES,
    new Date("2026-09-14T11:00:00.000Z"),
  );
  assert.equal(calculateBudgetUsage(budget, [original], "2026-09").status, "warning");
  assert.equal(calculateBudgetUsage(budget, edited, "2026-09").status, "normal");
  assert.equal(calculateBudgetUsage(budget, [], "2026-09").spentMinor, 0);
});

test("savings goals are manual, editable, and visually cap over target", () => {
  const goal = createMoneyGoal(
    { name: "Microwave", targetAmount: "8000", savedAmount: "4620" },
    { id: "goal:microwave", now: "2026-09-14T10:00:00.000Z" },
  );
  const once = addMoneyGoal([], goal);
  const repeated = addMoneyGoal(once, goal);
  const edited = editMoneyGoal(
    repeated,
    goal.id,
    { savedAmount: "9000" },
    new Date("2026-09-15T10:00:00.000Z"),
  );
  const progress = getGoalProgress(edited[0]);

  assert.equal(repeated, once);
  assert.equal(progress.percent, 113);
  assert.equal(progress.visualPercent, 100);
  assert.equal(edited[0].id, goal.id);
  assert.deepEqual(deleteMoneyGoal(edited, goal.id), []);
  assert.equal(deleteMoneyGoal(edited, "missing"), edited);
});

test("malformed persisted money records are ignored safely", () => {
  const valid = moneyTransaction({ id: "transaction:valid" });
  const document = normalizeMoneyDocument({
    version: 1,
    categories: DEFAULT_CATEGORIES,
    transactions: [
      valid,
      { ...valid, id: "bad amount", amountMinor: -1 },
      { ...valid, id: "transaction:bad-date", date: "2026-02-30" },
      { ...valid, id: "transaction:missing-category", categoryId: "missing" },
    ],
    budgets: [{ id: "bad", categoryId: "missing", monthlyLimitMinor: 1 }],
    goals: [{ id: "bad" }],
  });

  assert.deepEqual(document.transactions, [valid]);
  assert.deepEqual(document.budgets, []);
  assert.deepEqual(document.goals, []);
  assert.deepEqual(normalizeMoneyDocument(null), createEmptyMoneyDocument());
});

test("money document normalization isolates malformed slices and strips unknown fields", () => {
  const valid = moneyTransaction({ id: "transaction:mixed" });
  const normalized = normalizeMoneyDocument({
    version: 1,
    transactions: [valid],
    categories: [...DEFAULT_CATEGORIES, null, { id: "bad category" }],
    budgets: "corrupt",
    goals: null,
    availableMinor: 999999,
    analytics: { trusted: true },
    unknown: "discard me",
  });

  assert.deepEqual(Object.keys(normalized), [
    "version",
    "revision",
    "updatedAt",
    "transactions",
    "categories",
    "budgets",
    "goals",
  ]);
  assert.deepEqual(normalized.transactions, [valid]);
  assert.deepEqual(normalized.categories, DEFAULT_CATEGORIES);
  assert.deepEqual(normalized.budgets, []);
  assert.deepEqual(normalized.goals, []);
});

test("money analytics derive immutably from source transactions", () => {
  const transactions = [
    moneyTransaction({ id: "transaction:immutable-expense", amount: "10.01" }),
    moneyTransaction({
      id: "transaction:immutable-income",
      type: "income",
      amount: "20.02",
    }),
  ];
  const before = structuredClone(transactions);

  aggregateLedger(transactions);
  monthlyLedger(transactions);
  spendingByCategory(transactions);
  filterTransactions(transactions, { month: "2026-09" });

  assert.deepEqual(transactions, before);
});

test("money storage is isolated across account switches", () => {
  memory.clear();
  setStorageOwner(null);
  const userA = {
    version: 1,
    transactions: [{ owner: "A" }],
    categories: [{ owner: "A" }],
    budgets: [{ owner: "A" }],
    goals: [{ owner: "A" }],
  };
  const userB = {
    version: 1,
    transactions: [{ owner: "B" }],
    categories: [{ owner: "B" }],
    budgets: [{ owner: "B" }],
    goals: [{ owner: "B" }],
  };

  setStorageOwner("money-user-a");
  saveData(MONEY_STORAGE_KEY, userA);
  setStorageOwner(null);
  assert.equal(loadData(MONEY_STORAGE_KEY, null), null);
  setStorageOwner("money-user-b");
  assert.equal(loadData(MONEY_STORAGE_KEY, null), null);
  saveData(MONEY_STORAGE_KEY, userB);
  assert.deepEqual(loadData(MONEY_STORAGE_KEY, null), userB);
  setStorageOwner(null);
  setStorageOwner("money-user-a");
  assert.deepEqual(loadData(MONEY_STORAGE_KEY, null), userA);
});

test("money persistence rejects unauthenticated writes and recovers from malformed JSON", () => {
  memory.clear();
  setStorageOwner(null);
  const document = createEmptyMoneyDocument();

  assert.equal(saveMoneyDocument(document), null);
  assert.equal(memory.has(MONEY_STORAGE_KEY), false);

  setStorageOwner("money-corrupt");
  const scopedKey = getUserStorageKey("money-corrupt", MONEY_STORAGE_KEY);
  memory.set(scopedKey, "{not-json");
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    assert.deepEqual(loadMoneyDocument(), document);
    assert.equal(memory.get(scopedKey), "{not-json");
  } finally {
    console.warn = originalWarn;
  }
});

test("untouched Money defaults are not treated as syncable local source data", () => {
  memory.clear();
  setStorageOwner("money-empty-client");
  const empty = createEmptyMoneyDocument();

  assert.equal(hasMoneySourceData(empty), false);
  assert.ok(saveMoneyDocument(empty));
  assert.equal(loadMoneyDocumentForSync(), null);

  const legacyWithData = {
    ...empty,
    transactions: [moneyTransaction({ id: "transaction:legacy-source" })],
  };
  assert.equal(hasMoneySourceData(legacyWithData), true);
  assert.ok(saveMoneyDocument(legacyWithData));
  assert.equal(loadMoneyDocumentForSync().transactions.length, 1);
});

test("mounted money store switches all slices atomically across owners", async () => {
  memory.clear();
  setStorageOwner(null);
  const { useMoney } = await import("../src/features/money/js/store.js");

  setStorageOwner("mounted-money-a");
  assert.equal(
    useMoney.getState().addTransaction(
      {
        type: "expense",
        amount: "10",
        categoryId: "expense:food",
        date: "2026-09-14",
      },
      { id: "transaction:owner-a", now: "2026-09-14T10:00:00.000Z" },
    ),
    true,
  );
  assert.equal(
    useMoney.getState().addCategory(
      { name: "Owner A category", type: "expense" },
      "category:owner-a",
    ),
    true,
  );
  assert.equal(useMoney.getState().setBudget("expense:food", "100"), true);
  assert.equal(
    useMoney.getState().addGoal(
      { name: "Owner A goal", targetAmount: "100", savedAmount: "10" },
      { id: "goal:owner-a", now: "2026-09-14T10:00:00.000Z" },
    ),
    true,
  );
  const ownerA = structuredClone(useMoney.getState().data);
  assert.equal(ownerA.revision, 4);

  setStorageOwner(null);
  assert.equal(useMoney.getState().owner, null);
  assert.deepEqual(useMoney.getState().data, createEmptyMoneyDocument());

  setStorageOwner("mounted-money-b");
  assert.equal(useMoney.getState().owner, "mounted-money-b");
  assert.deepEqual(useMoney.getState().data, createEmptyMoneyDocument());
  assert.equal(
    useMoney.getState().addGoal(
      { name: "Owner B goal", targetAmount: "50", savedAmount: "5" },
      { id: "goal:owner-b", now: "2026-09-14T10:00:00.000Z" },
    ),
    true,
  );
  const ownerB = structuredClone(useMoney.getState().data);
  assert.equal(ownerB.revision, 1);

  useMoney.setState({ owner: "mounted-money-a", data: ownerA });
  assert.equal(useMoney.getState().deleteGoal("goal:owner-a"), false);
  assert.deepEqual(loadMoneyDocument(), ownerB);

  setStorageOwner(null);
  setStorageOwner("mounted-money-a");
  assert.equal(useMoney.getState().owner, "mounted-money-a");
  assert.deepEqual(useMoney.getState().data, ownerA);
});

test("empty ledger and deterministic same-day ordering stay stable", () => {
  assert.deepEqual(aggregateLedger([]), {
    incomeMinor: 0,
    expenseMinor: 0,
    netMinor: 0,
  });
  assert.deepEqual(monthlyLedger([]), []);

  const early = moneyTransaction({
    id: "transaction:early",
    now: "2026-09-14T08:00:00.000Z",
  });
  const lateB = moneyTransaction({
    id: "transaction:b",
    now: "2026-09-14T09:00:00.000Z",
  });
  const lateA = moneyTransaction({
    id: "transaction:a",
    now: "2026-09-14T09:00:00.000Z",
  });

  assert.deepEqual(
    sortTransactions([early, lateB, lateA]).map((item) => item.id),
    ["transaction:a", "transaction:b", "transaction:early"],
  );
});

const versionedMoneyDocument = (revision, label = "") => ({
  ...createEmptyMoneyDocument(),
  revision,
  updatedAt:
    revision > 0 ? `2026-09-15T10:00:${String(revision).padStart(2, "0")}.000Z` : null,
  goals: label
    ? [
        createMoneyGoal(
          { name: label, targetAmount: "100", savedAmount: "0" },
          {
            id: `goal:${label.toLowerCase().replaceAll(" ", "-")}`,
            now: "2026-09-15T10:00:00.000Z",
          },
        ),
      ]
    : [],
});

function createMoneySyncHarness({
  uid = "money-sync-user",
  local = versionedMoneyDocument(1, "Local"),
  cloud = structuredClone(local),
} = {}) {
  const state = {
    context: { authUid: uid, storeOwner: uid },
    local,
    cloud,
    offline: false,
    writes: [],
    loads: 0,
    statuses: [],
    timers: new Map(),
  };
  let timerId = 0;

  const controller = createMoneySyncController({
    getContext: () => state.context,
    getLocalDocument: (operationUid) =>
      state.context.storeOwner === operationUid ? state.local : null,
    applyCloudDocument: (operationUid, document) => {
      if (state.context.storeOwner === operationUid) {
        state.local = structuredClone(document);
        return true;
      }
      return false;
    },
    setStatus: (operationUid, status) => {
      state.statuses.push({ uid: operationUid, status });
    },
    loadCloudDocument: async () => {
      state.loads += 1;
      if (state.offline) throw new Error("offline");
      return structuredClone(state.cloud);
    },
    saveCloudDocument: async (operationUid, document) => {
      if (state.offline) throw new Error("offline");
      if (state.cloud && state.cloud.revision > document.revision) {
        return { written: false, document: structuredClone(state.cloud) };
      }
      state.writes.push({ uid: operationUid, document: structuredClone(document) });
      state.cloud = structuredClone(document);
      return { written: true, document: structuredClone(document) };
    },
    normalizeCloudDocument: normalizeMoneyCloudDocument,
    selectContent: selectMoneySource,
    schedule: (callback) => {
      const id = ++timerId;
      state.timers.set(id, callback);
      return id;
    },
    cancel: (id) => state.timers.delete(id),
  });

  return { controller, state, uid };
}

test("money revisions preserve the exact persisted source boundary", () => {
  const legacy = normalizeMoneyDocument({
    ...createEmptyMoneyDocument(),
    revision: undefined,
    updatedAt: undefined,
    dashboardTotal: 123,
  });
  const next = createNextMoneyDocument(
    { ...legacy, analytics: { shouldNotPersist: true } },
    legacy,
    new Date("2026-09-15T12:00:00.000Z"),
  );

  assert.equal(legacy.revision, 0);
  assert.equal(legacy.updatedAt, null);
  assert.equal(next.revision, 1);
  assert.equal(next.updatedAt, "2026-09-15T12:00:00.000Z");
  assert.deepEqual(Object.keys(next), [
    "version",
    "revision",
    "updatedAt",
    "transactions",
    "categories",
    "budgets",
    "goals",
  ]);
  assert.equal(
    normalizeMoneyCloudDocument({
      ...next,
      transactions: "malformed",
    }),
    null,
  );
});

test("Money document revisions increment once and timestamps stay monotonic", () => {
  const current = versionedMoneyDocument(4, "Current");
  current.updatedAt = "2026-09-15T12:00:00.000Z";
  const next = createNextMoneyDocument(
    current,
    current,
    new Date("2026-09-15T11:00:00.000Z"),
  );
  const afterInvalidClock = createNextMoneyDocument(next, next, "not-a-date");

  assert.equal(next.revision, 5);
  assert.equal(next.updatedAt, "2026-09-15T12:00:00.001Z");
  assert.equal(afterInvalidClock.revision, 6);
  assert.equal(Number.isNaN(Date.parse(afterInvalidClock.updatedAt)), false);
  assert.ok(Date.parse(afterInvalidClock.updatedAt) > Date.parse(next.updatedAt));
});

test("offline Money mutation stays local and reconnect uploads the latest revision", async () => {
  const harness = createMoneySyncHarness();
  await harness.controller.activate(harness.uid);
  harness.state.offline = true;
  harness.state.local = versionedMoneyDocument(2, "Offline edit");
  harness.controller.enqueue(harness.uid, harness.state.local);

  await assert.rejects(harness.controller.flush(harness.uid), /offline/);
  assert.equal(harness.state.local.revision, 2);
  assert.deepEqual(
    harness.state.statuses.slice(-3).map(({ status }) => status),
    ["pending", "syncing", "error"],
  );

  harness.state.offline = false;
  await harness.controller.recover(harness.uid);
  assert.equal(harness.state.cloud.revision, 2);
  assert.equal(harness.state.cloud.goals[0].name, "Offline edit");
  assert.equal(harness.state.statuses.at(-1).status, "synced");
});

test("rapid Money mutations coalesce and send only the newest revision", async () => {
  const harness = createMoneySyncHarness();
  await harness.controller.activate(harness.uid);

  harness.state.local = versionedMoneyDocument(2, "First edit");
  harness.controller.enqueue(harness.uid, harness.state.local);
  harness.state.local = versionedMoneyDocument(3, "Newest edit");
  harness.controller.enqueue(harness.uid, harness.state.local);

  assert.equal(harness.state.timers.size, 1);
  await harness.controller.flush(harness.uid);
  assert.deepEqual(harness.state.writes.map(({ document }) => document.revision), [3]);
  assert.equal(harness.state.cloud.goals[0].name, "Newest edit");
});

test("a stale Money write cannot overwrite a newer cloud revision", async () => {
  const harness = createMoneySyncHarness();
  await harness.controller.activate(harness.uid);

  harness.state.cloud = versionedMoneyDocument(5, "Newer cloud");
  harness.state.local = versionedMoneyDocument(2, "Stale local");
  harness.controller.enqueue(harness.uid, harness.state.local);
  await harness.controller.flush(harness.uid);

  assert.equal(harness.state.writes.length, 0);
  assert.equal(harness.state.cloud.revision, 5);
  assert.equal(harness.state.local.goals[0].name, "Newer cloud");
});

test("Money equal-revision reconciliation follows content and timestamp policy", async () => {
  const equal = createMoneySyncHarness();
  await equal.controller.activate(equal.uid);
  assert.equal(equal.state.writes.length, 0);

  const local = versionedMoneyDocument(2, "Local tie");
  const newerCloud = versionedMoneyDocument(2, "Cloud tie");
  newerCloud.updatedAt = "2026-09-15T10:00:03.000Z";
  const cloudWins = createMoneySyncHarness({ local, cloud: newerCloud });
  await cloudWins.controller.activate(cloudWins.uid);
  assert.equal(cloudWins.state.local.goals[0].name, "Cloud tie");
  assert.equal(cloudWins.state.writes.length, 0);

  const legacyLocal = versionedMoneyDocument(0, "Legacy local");
  const legacyCloud = versionedMoneyDocument(0, "Legacy cloud");
  const localWins = createMoneySyncHarness({
    local: legacyLocal,
    cloud: legacyCloud,
  });
  await localWins.controller.activate(localWins.uid);
  assert.equal(localWins.state.writes.length, 1);
  assert.equal(localWins.state.cloud.goals[0].name, "Legacy local");
});

test("Money background activation reconciles without mounting a Money route", async () => {
  const harness = createMoneySyncHarness({ cloud: null });

  await harness.controller.activate(harness.uid);

  assert.equal(harness.state.loads, 1);
  assert.equal(harness.state.writes.length, 1);
  assert.equal(harness.state.cloud.revision, 1);
});

test("empty new clients cannot seed or overwrite legacy revision-zero Money", async () => {
  const untouchedClient = createMoneySyncHarness({ local: null, cloud: null });
  await untouchedClient.controller.activate(untouchedClient.uid);
  assert.equal(untouchedClient.state.writes.length, 0);
  assert.equal(untouchedClient.state.cloud, null);

  const legacyDesktop = versionedMoneyDocument(0, "Desktop legacy data");
  const emptyCloud = createEmptyMoneyDocument();
  const desktop = createMoneySyncHarness({
    local: legacyDesktop,
    cloud: emptyCloud,
  });
  await desktop.controller.activate(desktop.uid);
  assert.equal(desktop.state.writes.length, 1);
  assert.equal(desktop.state.cloud.goals[0].name, "Desktop legacy data");

  const cleanMobile = createMoneySyncHarness({
    local: null,
    cloud: structuredClone(desktop.state.cloud),
  });
  await cleanMobile.controller.activate(cleanMobile.uid);
  assert.equal(cleanMobile.state.writes.length, 0);
  assert.equal(cleanMobile.state.local.goals[0].name, "Desktop legacy data");
});

test("Money reconciliation waits for the local-winning upload before syncing", async () => {
  let finishWrite;
  const local = versionedMoneyDocument(2, "Local winner");
  const cloud = versionedMoneyDocument(1, "Cloud older");
  const statuses = [];
  const controller = createMoneySyncController({
    getContext: () => ({ authUid: "owner", storeOwner: "owner" }),
    getLocalDocument: () => local,
    applyCloudDocument: () => true,
    setStatus: (_uid, status) => statuses.push(status),
    loadCloudDocument: async () => cloud,
    saveCloudDocument: (_uid, document) =>
      new Promise((resolve) => {
        finishWrite = () => resolve({ written: true, document });
      }),
    normalizeCloudDocument: normalizeMoneyCloudDocument,
    selectContent: selectMoneySource,
  });

  const activation = controller.activate("owner");
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(statuses.includes("synced"), false);
  finishWrite();
  assert.equal(await activation, true);
  assert.equal(statuses.at(-1), "synced");
});

test("a failed cloud-winner apply is never reported as synced", async () => {
  const local = versionedMoneyDocument(1, "Local older");
  const cloud = versionedMoneyDocument(2, "Cloud winner");
  const statuses = [];
  const controller = createMoneySyncController({
    getContext: () => ({ authUid: "owner", storeOwner: "owner" }),
    getLocalDocument: () => local,
    applyCloudDocument: () => false,
    setStatus: (_uid, status) => statuses.push(status),
    loadCloudDocument: async () => cloud,
    saveCloudDocument: async (_uid, document) => ({ written: true, document }),
    normalizeCloudDocument: normalizeMoneyCloudDocument,
    selectContent: selectMoneySource,
  });

  await assert.rejects(controller.activate("owner"), /Unable to persist/);
  assert.equal(statuses.at(-1), "error");
});

test("focus and visible-page recovery retry Money sync without polling", async () => {
  const listeners = { window: new Map(), document: new Map() };
  const windowTarget = {
    addEventListener: (name, listener) => listeners.window.set(name, listener),
    removeEventListener: (name) => listeners.window.delete(name),
  };
  const documentTarget = {
    visibilityState: "hidden",
    addEventListener: (name, listener) => listeners.document.set(name, listener),
    removeEventListener: (name) => listeners.document.delete(name),
  };
  const recovered = [];
  const unbind = bindMoneyRecoveryEvents(
    "recovery-user",
    async (uid) => recovered.push(uid),
    { windowTarget, documentTarget },
  );

  listeners.window.get("focus")();
  listeners.window.get("online")();
  listeners.document.get("visibilitychange")();
  documentTarget.visibilityState = "visible";
  listeners.document.get("visibilitychange")();
  await Promise.resolve();

  assert.deepEqual(recovered, ["recovery-user", "recovery-user", "recovery-user"]);
  unbind();
  assert.equal(listeners.window.size, 0);
  assert.equal(listeners.document.size, 0);
});

test("account switch invalidates a pending User A Money read", async () => {
  let resolveUserA;
  const documents = {
    A: versionedMoneyDocument(1, "A local"),
    B: versionedMoneyDocument(1, "B local"),
  };
  const context = { authUid: "A", storeOwner: "A" };
  const applied = [];
  const controller = createMoneySyncController({
    getContext: () => context,
    getLocalDocument: (uid) => documents[uid],
    applyCloudDocument: (uid, document) => {
      applied.push(uid);
      documents[uid] = document;
      return true;
    },
    setStatus: () => {},
    loadCloudDocument: (uid) =>
      uid === "A"
        ? new Promise((resolve) => {
            resolveUserA = resolve;
          })
        : Promise.resolve(versionedMoneyDocument(2, "B cloud")),
    saveCloudDocument: async (_uid, document) => ({ written: true, document }),
    normalizeCloudDocument: normalizeMoneyCloudDocument,
    selectContent: selectMoneySource,
  });

  const userAOperation = controller.activate("A");
  context.authUid = "B";
  context.storeOwner = "B";
  controller.deactivate("A");
  await controller.activate("B");
  resolveUserA(versionedMoneyDocument(9, "A cloud"));

  assert.equal(await userAOperation, false);
  assert.deepEqual(applied, ["B"]);
  assert.equal(documents.B.goals[0].name, "B cloud");
  assert.equal(documents.A.goals[0].name, "A local");
});

test("account switch prevents a pending User A Money write from touching B status", async () => {
  let resolveUserAWrite;
  const documents = {
    A: versionedMoneyDocument(1, "A local"),
    B: versionedMoneyDocument(1, "B local"),
  };
  const context = { authUid: "A", storeOwner: "A" };
  const statuses = [];
  const controller = createMoneySyncController({
    getContext: () => context,
    getLocalDocument: (uid) => documents[uid],
    applyCloudDocument: (uid, document) => {
      documents[uid] = document;
      return true;
    },
    setStatus: (uid, status) => statuses.push({ uid, status }),
    loadCloudDocument: async (uid) => structuredClone(documents[uid]),
    saveCloudDocument: (uid, document) =>
      uid === "A"
        ? new Promise((resolve) => {
            resolveUserAWrite = () =>
              resolve({ written: true, document: structuredClone(document) });
          })
        : Promise.resolve({ written: true, document }),
    normalizeCloudDocument: normalizeMoneyCloudDocument,
    selectContent: selectMoneySource,
  });

  await controller.activate("A");
  documents.A = versionedMoneyDocument(2, "A pending");
  controller.enqueue("A", documents.A);
  const userAWrite = controller.flush("A");

  context.authUid = "B";
  context.storeOwner = "B";
  controller.deactivate("A");
  await controller.activate("B");
  const statusCountBeforeAResolution = statuses.length;
  resolveUserAWrite();

  assert.equal(await userAWrite, false);
  assert.equal(statuses.length, statusCountBeforeAResolution);
  assert.equal(documents.B.goals[0].name, "B local");
});

test("logout cancels a queued Money timer and clears pending runtime work", async () => {
  const harness = createMoneySyncHarness();
  await harness.controller.activate(harness.uid);
  harness.state.local = versionedMoneyDocument(2, "Queued before logout");
  harness.controller.enqueue(harness.uid, harness.state.local);

  assert.equal(harness.state.timers.size, 1);
  harness.state.context = { authUid: null, storeOwner: null };
  harness.controller.deactivate(harness.uid);

  assert.equal(harness.state.timers.size, 0);
  assert.equal(harness.controller.isPending(), false);
  assert.equal(harness.state.writes.length, 0);
});

const toolTask = ({
  id,
  text = "Open the book",
  lane = "next",
  now = "2026-09-15T10:00:00.000Z",
} = {}) => createToolTask({ text, lane }, { id, now });

test("tool tasks enforce one Now item without silently replacing it", () => {
  const current = toolTask({ id: "task:current", lane: "now" });
  const candidate = toolTask({ id: "task:candidate", lane: "next" });
  const tasks = [current, candidate];
  const currentOnly = [current];

  assert.equal(addToolTask(currentOnly, toolTask({ id: "task:other", lane: "now" })), currentOnly);
  assert.equal(moveToolTask(tasks, candidate.id, "now"), tasks);

  const moved = moveToolTask(tasks, candidate.id, "now", {
    occupiedNow: "move-to-next",
    now: new Date("2026-09-15T11:00:00.000Z"),
  });
  assert.equal(getNowTask(moved).id, candidate.id);
  assert.equal(moved.find((task) => task.id === current.id).lane, "next");
});

test("tool task movement, completion, and ordering are deterministic", () => {
  const now = toolTask({ id: "task:now", lane: "now" });
  const nextA = toolTask({ id: "task:next-a" });
  const nextB = toolTask({ id: "task:next-b" });
  const tasks = [now, nextA, nextB];

  const movedNow = moveToolTask(tasks, now.id, "later");
  assert.equal(getNowTask(movedNow), null);
  assert.equal(getLaneTasks(movedNow, "later")[0].id, now.id);

  const reordered = reorderLaneTask(tasks, "next", nextB.id, -1);
  assert.deepEqual(getLaneTasks(reordered, "next").map((task) => task.id), [nextB.id, nextA.id]);
  assert.equal(reorderLaneTask(reordered, "next", nextB.id, -1), reordered);

  const completed = completeToolTask(tasks, now.id, {
    promoteNext: true,
    now: new Date("2026-09-15T12:00:00.000Z"),
  });
  assert.equal(getNowTask(completed).id, nextA.id);
  assert.equal(completed.find((task) => task.id === now.id).completedAt, "2026-09-15T12:00:00.000Z");
  assert.equal(completeToolTask(completed, now.id, { promoteNext: true }), completed);
});

test("tool task normalization rejects malformed lanes, text, duplicates, and extra Now items", () => {
  const now = toolTask({ id: "task:valid-now", lane: "now" });
  const next = toolTask({ id: "task:valid-next" });
  assert.deepEqual(
    normalizeToolTasks([
      now,
      { ...now, id: "task:extra-now" },
      next,
      { ...next },
      { ...next, id: "task:bad-lane", lane: "urgent" },
      { ...next, id: "task:blank", text: " " },
    ]),
    [now, next],
  );
});

test("Brain Dump supports multiline capture and idempotent promotion without copies", () => {
  const additions = createBrainDumpItems("reply to professor\nphysics revision\nreply to professor\n", {
    batchId: "brain:batch",
    now: "2026-09-15T10:00:00.000Z",
  });
  assert.deepEqual(additions.map((item) => item.text), ["reply to professor", "physics revision"]);
  const once = addBrainDumpItems([], additions);
  assert.equal(addBrainDumpItems(once, additions), once);

  const promoted = promoteBrainDumpItem([], once, additions[0].id, "next", {
    now: new Date("2026-09-15T11:00:00.000Z"),
  });
  assert.equal(promoted.changed, true);
  assert.equal(promoted.tasks.length, 1);
  assert.equal(promoted.brainDump.length, 1);
  assert.equal(promoted.tasks[0].id, `task:brain:${additions[0].id}`);

  const repeated = promoteBrainDumpItem(promoted.tasks, once, additions[0].id, "next");
  assert.equal(repeated.changed, false);
  assert.equal(repeated.tasks, promoted.tasks);
});

test("Brain Dump promotion respects an occupied Now lane", () => {
  const now = toolTask({ id: "task:occupied", lane: "now" });
  const item = createBrainDumpItems("new priority", {
    batchId: "brain:priority",
    now: "2026-09-15T10:00:00.000Z",
  })[0];
  const blocked = promoteBrainDumpItem([now], [item], item.id, "now");
  assert.equal(blocked.changed, false);

  const promoted = promoteBrainDumpItem([now], [item], item.id, "now", {
    occupiedNow: "move-to-next",
    now: new Date("2026-09-15T11:00:00.000Z"),
  });
  assert.equal(getNowTask(promoted.tasks).text, "new priority");
  assert.equal(promoted.tasks.find((task) => task.id === now.id).lane, "next");
  assert.deepEqual(promoted.brainDump, []);
});

const breakdownFixture = () => {
  const breakdown = createBreakdown("Prepare Physics", {
    id: "breakdown:physics",
    now: "2026-09-15T10:00:00.000Z",
  });
  let items = addBreakdown([], breakdown);
  items = addBreakdownStep(items, breakdown.id, {
    id: "step:syllabus",
    text: "Open syllabus",
    completed: false,
  });
  items = addBreakdownStep(items, breakdown.id, {
    id: "step:chapter",
    text: "Pick one chapter",
    completed: false,
  });
  return items;
};

test("breakdown steps add, toggle, reorder, and remove safely", () => {
  const items = breakdownFixture();
  assert.equal(firstIncompleteStep(items[0]).id, "step:syllabus");
  const toggled = toggleBreakdownStep(items, items[0].id, "step:syllabus");
  assert.equal(firstIncompleteStep(toggled[0]).id, "step:chapter");
  const reordered = reorderBreakdownStep(toggled, items[0].id, "step:chapter", -1);
  assert.deepEqual(reordered[0].steps.map((step) => step.id), ["step:chapter", "step:syllabus"]);
  const removed = removeBreakdownStep(reordered, items[0].id, "step:syllabus");
  assert.deepEqual(removed[0].steps.map((step) => step.id), ["step:chapter"]);
  assert.equal(removeBreakdownStep(removed, items[0].id, "missing"), removed);
});

test("breakdown promotion sends only the first incomplete step and stays idempotent", () => {
  const breakdown = breakdownFixture()[0];
  const sent = sendBreakdownStepToLane([], breakdown, "now", {
    now: new Date("2026-09-15T11:00:00.000Z"),
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].text, "Open syllabus");
  assert.equal(sendBreakdownStepToLane(sent, breakdown, "now"), sent);
});

test("breakdown occupied-Now resolution preserves both tasks", () => {
  const currentNow = toolTask({ id: "task:current-now", lane: "now" });
  const breakdown = breakdownFixture()[0];
  const blockedTasks = [currentNow];

  assert.equal(
    sendBreakdownStepToLane(blockedTasks, breakdown, "now"),
    blockedTasks,
  );

  const resolved = sendBreakdownStepToLane(
    blockedTasks,
    breakdown,
    "now",
    {
      occupiedNow: "move-to-next",
      now: new Date("2026-09-15T11:00:00.000Z"),
    },
  );

  assert.equal(resolved.length, 2);
  assert.equal(getNowTask(resolved).text, "Open syllabus");
  assert.equal(getLaneTasks(resolved, "next")[0].id, currentNow.id);
  assert.equal(
    sendBreakdownStepToLane(resolved, breakdown, "now", {
      occupiedNow: "move-to-next",
    }),
    resolved,
  );
});

test("awareness timer derives elapsed, remaining, and target end from timestamps", () => {
  const timer = startAwarenessTimer(25, new Date("2026-09-15T10:00:00.000Z"));
  assert.deepEqual(deriveAwarenessTimer(timer, new Date("2026-09-15T10:07:00.000Z")), {
    elapsedMs: 420000,
    remainingMs: 1080000,
    targetEnd: "2026-09-15T10:25:00.000Z",
    finished: false,
  });
  const delayed = deriveAwarenessTimer(timer, new Date("2026-09-15T10:40:00.000Z"));
  assert.equal(delayed.elapsedMs, 1500000);
  assert.equal(delayed.remainingMs, 0);
  assert.equal(delayed.targetEnd, "2026-09-15T10:25:00.000Z");
  assert.equal(delayed.finished, true);
});

test("awareness timer pause and resume exclude paused time", () => {
  const timer = startAwarenessTimer(10, new Date("2026-09-15T10:00:00.000Z"));
  const paused = pauseAwarenessTimer(timer, new Date("2026-09-15T10:03:00.000Z"));
  assert.equal(deriveAwarenessTimer(paused, new Date("2026-09-15T10:08:00.000Z")).elapsedMs, 180000);
  const resumed = resumeAwarenessTimer(paused, new Date("2026-09-15T10:08:00.000Z"));
  const derived = deriveAwarenessTimer(resumed, new Date("2026-09-15T10:10:00.000Z"));
  assert.equal(derived.elapsedMs, 300000);
  assert.equal(derived.remainingMs, 300000);
  assert.equal(derived.targetEnd, "2026-09-15T10:15:00.000Z");
  const finished = finishAwarenessTimer(resumed, new Date("2026-09-15T10:10:00.000Z"));
  assert.equal(finished.status, "finished");
  assert.equal(finishAwarenessTimer(finished), finished);
});

test("awareness timer pause and resume remain correct after long suspension", () => {
  const timer = startAwarenessTimer(
    60,
    new Date("2026-09-15T10:00:00.000Z"),
  );
  const paused = pauseAwarenessTimer(
    timer,
    new Date("2026-09-15T10:05:00.000Z"),
  );
  const resumed = resumeAwarenessTimer(
    paused,
    new Date("2026-09-16T10:05:00.000Z"),
  );
  const derived = deriveAwarenessTimer(
    resumed,
    new Date("2026-09-16T10:15:00.000Z"),
  );

  assert.equal(derived.elapsedMs, 15 * 60_000);
  assert.equal(derived.remainingMs, 45 * 60_000);
  assert.equal(derived.targetEnd, "2026-09-16T11:00:00.000Z");
});

test("awareness timer rejects invalid duration", () => {
  assert.equal(startAwarenessTimer(0), IDLE_TIMER);
  assert.equal(startAwarenessTimer(-5), IDLE_TIMER);
  assert.equal(startAwarenessTimer(1.5), IDLE_TIMER);
  assert.equal(startAwarenessTimer(Number.NaN), IDLE_TIMER);
});

test("tools persistence rejects unsupported versions and isolates malformed slices", () => {
  assert.deepEqual(normalizeToolsDocument({ version: 2, tasks: [{}] }), createEmptyToolsDocument());
  const task = toolTask({ id: "task:persisted" });
  const breakdown = breakdownFixture()[0];
  const normalized = normalizeToolsDocument({
    version: 1,
    tasks: [task, null],
    brainDump: "bad",
    breakdowns: [
      {
        ...breakdown,
        steps: [
          breakdown.steps[0],
          null,
          breakdown.steps[0],
          { id: "step:blank", text: " ", completed: false },
        ],
      },
      null,
    ],
    resetPreferences: { steps: [null] },
    counts: { now: 50 },
  });
  assert.deepEqual(Object.keys(normalized), [
    "version",
    "tasks",
    "brainDump",
    "notes",
    "breakdowns",
    "migratedLaneIds",
    "resetPreferences",
  ]);
  assert.deepEqual(normalized.tasks, [task]);
  assert.deepEqual(normalized.brainDump, []);
  assert.equal(normalized.breakdowns.length, 1);
  assert.deepEqual(normalized.breakdowns[0].steps, [breakdown.steps[0]]);
  assert.equal(normalized.resetPreferences.steps.length > 0, true);
});

test("Reset Mode checkmarks remain runtime-only and are never persisted", () => {
  memory.clear();
  setStorageOwner("tools-reset-runtime");
  const document = {
    ...createEmptyToolsDocument(),
    resetPreferences: {
      steps: [
        {
          id: "reset:water",
          text: "Drink some water",
          checked: true,
        },
      ],
    },
    resetSession: { checkedIds: ["reset:water"] },
  };

  const saved = saveToolsDocument(document);
  const stored = JSON.parse(
    memory.get(getUserStorageKey("tools-reset-runtime", TOOLS_STORAGE_KEY)),
  );

  assert.deepEqual(Object.keys(saved), [
    "version",
    "tasks",
    "brainDump",
    "notes",
    "breakdowns",
    "migratedLaneIds",
    "resetPreferences",
  ]);
  assert.deepEqual(saved.resetPreferences.steps, [
    { id: "reset:water", text: "Drink some water" },
  ]);
  assert.equal("resetSession" in stored, false);
  assert.equal("checked" in stored.resetPreferences.steps[0], false);
});

test("tools persistence rejects pre-auth writes and malformed scoped JSON", () => {
  memory.clear();
  setStorageOwner(null);
  const empty = createEmptyToolsDocument();
  assert.equal(saveToolsDocument(empty), null);

  setStorageOwner("tools-corrupt");
  const key = getUserStorageKey("tools-corrupt", TOOLS_STORAGE_KEY);
  memory.set(key, "{not-json");
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.deepEqual(loadToolsDocument(), empty);
    assert.equal(memory.get(key), "{not-json");
  } finally {
    console.warn = originalWarn;
  }
});

test("mounted tools store switches every persisted slice across accounts", async () => {
  memory.clear();
  setStorageOwner(null);
  const { useAuth } = await import("../src/core/auth/authState.js");
  const { useTools } = await import("../src/features/plan/legacyTools/js/store.js");

  assert.equal(useTools.getState().addTask({ text: "No owner", lane: "now" }), false);

  useAuth.setState({ user: { uid: "tools-owner-a" } });
  setStorageOwner("tools-owner-a");
  assert.equal(useTools.getState().addTask({ text: "A task", lane: "now" }, { id: "task:owner-a" }), true);
  assert.equal(useTools.getState().captureBrainDump("A thought", { batchId: "brain:owner-a" }), true);
  assert.equal(useTools.getState().addBreakdown("A breakdown", { id: "breakdown:owner-a" }), true);
  assert.equal(useTools.getState().editResetStep("reset:water", "A water reminder"), true);
  const ownerA = structuredClone(useTools.getState().data);

  useAuth.setState({ user: null });
  setStorageOwner(null);
  assert.equal(useTools.getState().owner, null);
  assert.deepEqual(useTools.getState().data, createEmptyToolsDocument());

  useAuth.setState({ user: { uid: "tools-owner-b" } });
  setStorageOwner("tools-owner-b");
  assert.deepEqual(useTools.getState().data, createEmptyToolsDocument());
  assert.equal(useTools.getState().addTask({ text: "B task", lane: "later" }, { id: "task:owner-b" }), true);
  const ownerB = structuredClone(useTools.getState().data);

  useTools.setState({ owner: "tools-owner-a", data: ownerA });
  assert.equal(useTools.getState().deleteTask("task:owner-a"), false);
  assert.deepEqual(loadToolsDocument(), ownerB);

  useAuth.setState({ user: null });
  setStorageOwner(null);
  useAuth.setState({ user: { uid: "tools-owner-a" } });
  setStorageOwner("tools-owner-a");
  assert.deepEqual(useTools.getState().data, ownerA);
  assert.equal(useTools.getState().timer, IDLE_TIMER);
  useAuth.setState({ user: null });
  setStorageOwner(null);
});

const composureInput = (date, overrides = {}) => ({
  date,
  checks: {
    ...createEmptyComposureChecks(),
    calmVoice: true,
  },
  composureRating: 4,
  tomorrowNote: "Explain once, then leave.",
  ...overrides,
});

const composureRecord = (date, overrides = {}) =>
  upsertComposureReview(
    [],
    composureInput(date, overrides),
    new Date(`${date}T12:00:00.000Z`),
  )[0];

test("Composure creates today and updates the same local day without duplication", () => {
  const date = getToday(new Date(2026, 8, 16, 23, 45));
  const created = upsertComposureReview(
    [],
    composureInput(date),
    new Date("2026-09-16T10:00:00.000Z"),
  );
  const updated = upsertComposureReview(
    created,
    composureInput(date, {
      composureRating: 2,
      tomorrowNote: "Pause before answering.",
    }),
    new Date("2026-09-16T11:00:00.000Z"),
  );

  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, `composure:${date}`);
  assert.equal(updated[0].createdAt, created[0].createdAt);
  assert.equal(updated[0].composureRating, 2);
  assert.equal(updated[0].tomorrowNote, "Pause before answering.");
});

test("Composure keeps records separate across the local midnight boundary", () => {
  const beforeMidnight = new Date(2026, 11, 31, 23, 59, 59);
  const afterMidnight = new Date(2027, 0, 1, 0, 0, 1);
  const firstDate = getToday(beforeMidnight);
  const secondDate = getToday(afterMidnight);
  let reviews = upsertComposureReview(
    [],
    composureInput(firstDate),
    beforeMidnight,
  );
  reviews = upsertComposureReview(
    reviews,
    composureInput(secondDate),
    afterMidnight,
  );

  assert.equal(firstDate, "2026-12-31");
  assert.equal(secondDate, "2027-01-01");
  assert.deepEqual(reviews.map((review) => review.date), [
    "2027-01-01",
    "2026-12-31",
  ]);
});

test("Composure checklist and rating normalization ignore unsupported values", () => {
  const checks = normalizeComposureChecks({
    calmVoice: true,
    noOverExplaining: "yes",
    ratesOtherPerson: true,
  });

  assert.equal(Object.keys(checks).length, COMPOSURE_CHECKLIST.length);
  assert.equal(checks.calmVoice, true);
  assert.equal(checks.noOverExplaining, false);
  assert.equal("ratesOtherPerson" in checks, false);
  assert.equal(normalizeComposureRating(1), 1);
  assert.equal(normalizeComposureRating(5), 5);
  assert.equal(normalizeComposureRating("5"), null);
  assert.equal(normalizeComposureRating(0), null);
  assert.equal(normalizeComposureRating(6), null);
  assert.equal(normalizeComposureRating(3.5), null);
  assert.equal(normalizeComposureRating("bad"), null);
  assert.equal(normalizeComposureNote("x".repeat(300)).length, 240);
  assert.equal(normalizeComposureNote(null), "");
});

test("Composure history is newest-first and duplicate dates keep the latest update", () => {
  const older = composureRecord("2026-09-15", { composureRating: 2 });
  const original = composureRecord("2026-09-16", { composureRating: 3 });
  const replacement = {
    ...original,
    composureRating: 5,
    updatedAt: "2026-09-16T13:00:00.000Z",
  };
  const malformedLater = {
    ...replacement,
    id: "not-the-deterministic-id",
    composureRating: 1,
    updatedAt: "2026-09-16T14:00:00.000Z",
  };
  const reviews = normalizeComposureReviews([
    original,
    older,
    null,
    replacement,
    malformedLater,
  ]);

  assert.deepEqual(reviews.map((review) => review.date), [
    "2026-09-16",
    "2026-09-15",
  ]);
  assert.equal(reviews[0].composureRating, 5);
  assert.deepEqual(sortComposureHistory(reviews), reviews);
});

test("Composure weekly filtering uses local Monday boundaries across years", () => {
  const reviews = [
    composureRecord("2025-12-28"),
    composureRecord("2025-12-29"),
    composureRecord("2025-12-31"),
    composureRecord("2026-01-04"),
    composureRecord("2026-01-05"),
  ];
  const weekly = filterComposureWeek(
    reviews,
    new Date(2026, 0, 1, 12, 0),
  );

  assert.deepEqual(weekly.map((review) => review.date), [
    "2026-01-04",
    "2025-12-31",
    "2025-12-29",
  ]);
});

test("Composure averages keep ratings and checklist completion separate", () => {
  const allChecked = Object.fromEntries(
    COMPOSURE_CHECKLIST.map(({ id }) => [id, true]),
  );
  const reviews = [
    composureRecord("2026-09-15", {
      checks: allChecked,
      composureRating: 5,
    }),
    composureRecord("2026-09-16", {
      checks: createEmptyComposureChecks(),
      composureRating: null,
    }),
  ];

  assert.equal(countComposureChecks(reviews[0]), COMPOSURE_CHECKLIST.length);
  assert.equal(averageComposureRating(reviews), 5);
  assert.equal(averageChecklistCompletion(reviews), 50);
  assert.deepEqual(
    getComposureWeeklyMetrics(reviews, new Date(2026, 8, 16, 12, 0)),
    {
      reviewsCompleted: 2,
      averageRating: 5,
      averageChecklistCompletion: 50,
    },
  );
  assert.equal(averageComposureRating([]), null);
  assert.equal(averageChecklistCompletion([]), null);
});

test("Composure persistence isolates malformed data and unsupported versions", () => {
  const valid = composureRecord("2026-09-16");
  const normalized = normalizeComposureDocument({
    version: 1,
    reviews: [
      valid,
      { ...valid, id: "bad-id", date: "2026-09-17" },
      { ...valid, id: "composure:2026-02-30", date: "2026-02-30" },
    ],
    averageRating: 5,
    noteDraft: "must not persist",
  });

  assert.deepEqual(Object.keys(normalized), ["version", "reviews"]);
  assert.deepEqual(normalized.reviews, [valid]);
  assert.deepEqual(
    normalizeComposureDocument({ version: 2, reviews: [valid] }),
    createEmptyComposureDocument(),
  );
  assert.deepEqual(
    normalizeComposureDocument({ version: 1, reviews: "bad" }),
    createEmptyComposureDocument(),
  );
});

test("Composure persistence rejects pre-auth writes and preserves malformed JSON", () => {
  memory.clear();
  setStorageOwner(null);
  assert.equal(saveComposureDocument(createEmptyComposureDocument()), null);

  setStorageOwner("composure-corrupt");
  const key = getUserStorageKey(
    "composure-corrupt",
    COMPOSURE_STORAGE_KEY,
  );
  memory.set(key, "{not-json");
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.deepEqual(loadComposureDocument(), createEmptyComposureDocument());
    assert.equal(memory.get(key), "{not-json");
  } finally {
    console.warn = originalWarn;
  }
});

test("mounted Composure store isolates A to B to A account transitions", async () => {
  memory.clear();
  setStorageOwner(null);
  const { useComposure } = await import(
    "../src/features/insights/review/js/composureStore.js"
  );
  assert.equal(useComposure.getState().saveToday(composureInput("2026-09-16")), false);

  setStorageOwner("composure-owner-a");
  assert.equal(useComposure.getState().saveToday(
    composureInput("2026-09-16", { tomorrowNote: "A note" }),
    new Date("2026-09-16T10:00:00.000Z"),
  ), true);
  const ownerA = structuredClone(useComposure.getState().data);

  setStorageOwner(null);
  assert.deepEqual(useComposure.getState().data, createEmptyComposureDocument());
  setStorageOwner("composure-owner-b");
  assert.deepEqual(useComposure.getState().data, createEmptyComposureDocument());
  assert.equal(useComposure.getState().saveToday(
    composureInput("2026-09-16", { tomorrowNote: "B note" }),
    new Date("2026-09-16T11:00:00.000Z"),
  ), true);

  useComposure.setState({ owner: "composure-owner-a", data: ownerA });
  assert.equal(useComposure.getState().saveToday(
    composureInput("2026-09-17"),
  ), false);

  setStorageOwner(null);
  setStorageOwner("composure-owner-a");
  assert.deepEqual(useComposure.getState().data, ownerA);
});

test("Composure data never changes execution review scoring", () => {
  const input = {
    tasks: [{ done: true }],
    habits: [{ done: true }],
    sessions: [],
    workoutStats: {},
    scheduledWorkout: null,
  };
  const baseline = generateReview(input);
  const withComposure = generateReview({
    ...input,
    composureReviews: [composureRecord(getToday())],
  });

  assert.deepEqual(withComposure, baseline);
});
