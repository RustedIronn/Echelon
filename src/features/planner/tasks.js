import { getToday, isValidDayKey, parseDayKey } from "@/shared/date";

const ID_PATTERN = /^[a-zA-Z0-9:_-]+$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const PRIORITIES = new Set(["low", "normal", "high"]);

const normalizeTimestamp = (value) => {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeOptionalText = (value, maxLength) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

export function createPlannerId(cryptoApi = globalThis.crypto) {
  const uuid = cryptoApi?.randomUUID?.();
  return uuid ? `planner:${uuid}` : `planner:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function normalizePlannerTask(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.id !== "string" || !ID_PATTERN.test(value.id)) return null;
  const title = normalizeOptionalText(value.title, 140);
  if (!title) return null;

  const date = value.date === null || value.date === ""
    ? null
    : isValidDayKey(value.date) ? value.date : null;
  const time = value.time === null || value.time === ""
    ? null
    : TIME_PATTERN.test(value.time) ? value.time : null;
  const createdAt = normalizeTimestamp(value.createdAt);
  const updatedAt = normalizeTimestamp(value.updatedAt);
  if (!createdAt || !updatedAt) return null;

  return {
    id: value.id,
    title,
    notes: normalizeOptionalText(value.notes, 500),
    date,
    time: date ? time : null,
    priority: PRIORITIES.has(value.priority) ? value.priority : "normal",
    completedAt: normalizeTimestamp(value.completedAt),
    createdAt,
    updatedAt,
  };
}

export function normalizePlannerTasks(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.reduce((tasks, candidate) => {
    const task = normalizePlannerTask(candidate);
    if (!task || ids.has(task.id)) return tasks;
    ids.add(task.id);
    tasks.push(task);
    return tasks;
  }, []);
}

export function createPlannerTask(input, options = {}) {
  const now = new Date(options.now ?? Date.now());
  const timestamp = now.toISOString();
  return normalizePlannerTask({
    id: options.id ?? createPlannerId(),
    title: input?.title,
    notes: input?.notes,
    date: input?.date || null,
    time: input?.time || null,
    priority: input?.priority,
    completedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function plannerTaskFromLegacyLane(task, today = getToday()) {
  if (!task || typeof task.id !== "string") return null;
  return normalizePlannerTask({
    id: `planner:legacy:${task.id}`,
    title: task.text,
    notes: "",
    date: task.lane === "now" ? today : null,
    time: null,
    priority: task.lane === "now" ? "high" : task.lane === "later" ? "low" : "normal",
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  });
}

export function addPlannerTask(tasks, task) {
  if (!task || tasks.some((item) => item.id === task.id)) return tasks;
  return [...tasks, task];
}

export function togglePlannerTask(tasks, id, now = new Date()) {
  let changed = false;
  const timestamp = new Date(now).toISOString();
  const next = tasks.map((task) => {
    if (task.id !== id) return task;
    changed = true;
    return {
      ...task,
      completedAt: task.completedAt ? null : timestamp,
      updatedAt: timestamp,
    };
  });
  return changed ? next : tasks;
}

export function reschedulePlannerTask(tasks, id, date, time = null, now = new Date()) {
  const normalizedDate = date && isValidDayKey(date) ? date : null;
  const normalizedTime = normalizedDate && typeof time === "string" && TIME_PATTERN.test(time)
    ? time
    : null;
  let changed = false;
  const next = tasks.map((task) => {
    if (task.id !== id) return task;
    if (task.date === normalizedDate && task.time === normalizedTime) return task;
    changed = true;
    return { ...task, date: normalizedDate, time: normalizedTime, updatedAt: new Date(now).toISOString() };
  });
  return changed ? next : tasks;
}

export function deletePlannerTask(tasks, id) {
  if (!tasks.some((task) => task.id === id)) return tasks;
  return tasks.filter((task) => task.id !== id);
}

export function setPlannerTaskPriority(tasks, id, priority, now = new Date()) {
  if (!PRIORITIES.has(priority)) return tasks;
  let changed = false;
  const next = tasks.map((task) => {
    if (task.id !== id || task.priority === priority) return task;
    changed = true;
    return { ...task, priority, updatedAt: new Date(now).toISOString() };
  });
  return changed ? next : tasks;
}

export function getPlannerTasksForView(tasks, view, now = new Date()) {
  const today = getToday(now);
  const filtered = tasks.filter((task) => {
    if (view === "completed") return Boolean(task.completedAt);
    if (view === "today") return task.date === today;
    if (view === "upcoming") return task.date && task.date > today && !task.completedAt;
    return !task.date && !task.completedAt;
  });

  return [...filtered].sort((left, right) => {
    if (Boolean(left.completedAt) !== Boolean(right.completedAt)) return left.completedAt ? 1 : -1;
    const leftDate = left.date ?? "9999-12-31";
    const rightDate = right.date ?? "9999-12-31";
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    if (!left.date && left.priority !== right.priority) {
      const rank = { high: 0, normal: 1, low: 2 };
      return rank[left.priority] - rank[right.priority];
    }
    if ((left.time ?? "99:99") !== (right.time ?? "99:99")) return (left.time ?? "99:99").localeCompare(right.time ?? "99:99");
    return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
  });
}

export function getTodayPlannerTasks(tasks, now = new Date()) {
  return getPlannerTasksForView(tasks, "today", now);
}

export function shiftPlannerDate(dayKey, days) {
  const date = parseDayKey(dayKey);
  if (!date || !Number.isInteger(days)) return null;
  date.setDate(date.getDate() + days);
  return getToday(date);
}

export function toFocusMission(task) {
  return {
    id: task.id,
    title: task.title,
    description: task.notes || "One-off Planner item",
    category: "build",
    start: task.time || "Flexible",
    end: "",
    source: "planner",
  };
}
