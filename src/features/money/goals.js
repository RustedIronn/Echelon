import {
  isValidMoneyDate,
  isValidMoneyId,
  parseMoneyToMinor,
} from "./transactions.js";

const timestamp = (value) => {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
};

export function normalizeGoal(value) {
  const name = typeof value?.name === "string" ? value.name.trim() : "";
  const createdAt = timestamp(value?.createdAt);
  const updatedAt = timestamp(value?.updatedAt);
  const targetDate =
    value?.targetDate === null || value?.targetDate === ""
      ? null
      : value?.targetDate;

  if (
    !isValidMoneyId(value?.id) ||
    !name ||
    !Number.isSafeInteger(value?.targetAmountMinor) ||
    value.targetAmountMinor <= 0 ||
    !Number.isSafeInteger(value?.savedAmountMinor) ||
    value.savedAmountMinor < 0 ||
    (targetDate !== null && !isValidMoneyDate(targetDate)) ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id: value.id,
    name,
    targetAmountMinor: value.targetAmountMinor,
    savedAmountMinor: value.savedAmountMinor,
    targetDate,
    createdAt,
    updatedAt,
  };
}

export function normalizeGoals(value) {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set();
  return value.reduce((goals, item) => {
    const goal = normalizeGoal(item);
    if (!goal || usedIds.has(goal.id)) return goals;
    usedIds.add(goal.id);
    goals.push(goal);
    return goals;
  }, []);
}

export function createGoal(input, metadata) {
  const now =
    metadata?.now instanceof Date
      ? metadata.now
      : metadata?.now === undefined
        ? new Date()
        : new Date(metadata.now);
  if (Number.isNaN(now.getTime())) return null;

  return normalizeGoal({
    id: metadata?.id,
    name: input?.name,
    targetAmountMinor: parseMoneyToMinor(input?.targetAmount),
    savedAmountMinor: parseMoneyToMinor(input?.savedAmount ?? "0"),
    targetDate: input?.targetDate || null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
}

export function addGoal(goals, goal) {
  if (!goal || goals.some((item) => item.id === goal.id)) return goals;
  return [...goals, goal];
}

export function editGoal(goals, id, patch, now = new Date()) {
  const index = goals.findIndex((goal) => goal.id === id);
  if (index === -1 || Number.isNaN(now.getTime())) return goals;
  const current = goals[index];
  const updated = normalizeGoal({
    ...current,
    ...patch,
    id: current.id,
    targetAmountMinor:
      patch.targetAmount === undefined
        ? current.targetAmountMinor
        : parseMoneyToMinor(patch.targetAmount),
    savedAmountMinor:
      patch.savedAmount === undefined
        ? current.savedAmountMinor
        : parseMoneyToMinor(patch.savedAmount),
    createdAt: current.createdAt,
    updatedAt: now.toISOString(),
  });
  if (!updated) return goals;

  const next = [...goals];
  next[index] = updated;
  return next;
}

export function deleteGoal(goals, id) {
  if (!goals.some((goal) => goal.id === id)) return goals;
  return goals.filter((goal) => goal.id !== id);
}

export function getGoalProgress(goal) {
  const ratio = goal.savedAmountMinor / goal.targetAmountMinor;
  return {
    ...goal,
    percent: Math.max(0, Math.round(ratio * 100)),
    visualPercent: Math.min(100, Math.max(0, ratio * 100)),
  };
}
