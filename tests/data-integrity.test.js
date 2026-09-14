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
  getAdjacentWorkoutDates,
  getCalendarMonth,
  groupWorkoutHistoryByDate,
  shiftCalendarMonth,
  sortWorkoutHistory,
} from "../src/features/workout/history.js";
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
