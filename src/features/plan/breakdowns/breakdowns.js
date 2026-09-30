import { addToolTask, createToolTask, getNowTask } from "../legacyTools/js/tasks.js";
import {
  isValidToolsId,
  normalizeText,
  normalizeToolsTimestamp,
} from "../legacyTools/js/utils.js";

const normalizeStep = (value) => {
  const text = normalizeText(value?.text);
  if (!isValidToolsId(value?.id) || !text || typeof value?.completed !== "boolean") {
    return null;
  }
  return { id: value.id, text, completed: value.completed };
};

export function normalizeBreakdown(value) {
  const title = normalizeText(value?.title);
  const createdAt = normalizeToolsTimestamp(value?.createdAt);
  const updatedAt = normalizeToolsTimestamp(value?.updatedAt);
  if (!isValidToolsId(value?.id) || !title || !createdAt || !updatedAt) return null;

  const stepIds = new Set();
  const steps = Array.isArray(value.steps)
    ? value.steps.reduce((items, entry) => {
        const step = normalizeStep(entry);
        if (!step || stepIds.has(step.id)) return items;
        stepIds.add(step.id);
        items.push(step);
        return items;
      }, [])
    : [];

  const inferredParent = value.id.startsWith("breakdown:planner:")
    ? { type: "planner", id: value.id.slice("breakdown:".length) }
    : value.id.startsWith("breakdown:note:")
      ? { type: "note", id: value.id.slice("breakdown:note:".length) }
      : null;
  const parent = ["planner", "note"].includes(value.parent?.type) && isValidToolsId(value.parent?.id)
    ? { type: value.parent.type, id: value.parent.id }
    : inferredParent;
  return { id: value.id, title, parent, steps, createdAt, updatedAt };
}

export function normalizeBreakdowns(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.reduce((items, entry) => {
    const breakdown = normalizeBreakdown(entry);
    if (!breakdown || ids.has(breakdown.id)) return items;
    ids.add(breakdown.id);
    items.push(breakdown);
    return items;
  }, []);
}

export function createBreakdown(title, metadata = {}) {
  const now = new Date(metadata.now ?? Date.now());
  if (Number.isNaN(now.getTime())) return null;
  const timestamp = now.toISOString();
  return normalizeBreakdown({
    id: metadata.id,
    title,
    parent: metadata.parent ?? null,
    steps: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function addBreakdown(items, breakdown) {
  if (!breakdown || items.some((item) => item.id === breakdown.id)) return items;
  return [...items, breakdown];
}

export function renameBreakdown(items, id, title, now = new Date()) {
  const text = normalizeText(title);
  const index = items.findIndex((item) => item.id === id);
  if (!text || index === -1 || Number.isNaN(now.getTime())) return items;
  if (items[index].title === text) return items;
  const next = [...items];
  next[index] = { ...items[index], title: text, updatedAt: now.toISOString() };
  return next;
}

export function addBreakdownStep(items, breakdownId, step, now = new Date()) {
  const index = items.findIndex((item) => item.id === breakdownId);
  const normalized = normalizeStep(step);
  if (
    index === -1 ||
    !normalized ||
    items[index].steps.some((item) => item.id === normalized.id) ||
    Number.isNaN(now.getTime())
  ) {
    return items;
  }
  const next = [...items];
  next[index] = {
    ...items[index],
    steps: [...items[index].steps, normalized],
    updatedAt: now.toISOString(),
  };
  return next;
}

export function removeBreakdownStep(items, breakdownId, stepId, now = new Date()) {
  const index = items.findIndex((item) => item.id === breakdownId);
  if (
    index === -1 ||
    !items[index].steps.some((step) => step.id === stepId) ||
    Number.isNaN(now.getTime())
  ) {
    return items;
  }
  const next = [...items];
  next[index] = {
    ...items[index],
    steps: items[index].steps.filter((step) => step.id !== stepId),
    updatedAt: now.toISOString(),
  };
  return next;
}

export function toggleBreakdownStep(items, breakdownId, stepId, now = new Date()) {
  const index = items.findIndex((item) => item.id === breakdownId);
  if (
    index === -1 ||
    !items[index].steps.some((step) => step.id === stepId) ||
    Number.isNaN(now.getTime())
  ) {
    return items;
  }
  const next = [...items];
  next[index] = {
    ...items[index],
    steps: items[index].steps.map((step) =>
      step.id === stepId ? { ...step, completed: !step.completed } : step,
    ),
    updatedAt: now.toISOString(),
  };
  return next;
}

export function reorderBreakdownStep(items, breakdownId, stepId, direction, now = new Date()) {
  const index = items.findIndex((item) => item.id === breakdownId);
  if (index === -1 || ![-1, 1].includes(direction) || Number.isNaN(now.getTime())) {
    return items;
  }
  const stepIndex = items[index].steps.findIndex((step) => step.id === stepId);
  const swapIndex = stepIndex + direction;
  if (stepIndex === -1 || swapIndex < 0 || swapIndex >= items[index].steps.length) {
    return items;
  }
  const steps = [...items[index].steps];
  [steps[stepIndex], steps[swapIndex]] = [steps[swapIndex], steps[stepIndex]];
  const next = [...items];
  next[index] = { ...items[index], steps, updatedAt: now.toISOString() };
  return next;
}

export function firstIncompleteStep(breakdown) {
  return breakdown?.steps?.find((step) => !step.completed) ?? null;
}

export function deleteBreakdown(items, id) {
  if (!items.some((item) => item.id === id)) return items;
  return items.filter((item) => item.id !== id);
}

export function attachBreakdown(items, id, parent, now = new Date()) {
  if (!["planner", "note"].includes(parent?.type) || !isValidToolsId(parent?.id) || Number.isNaN(now.getTime())) return items;
  if (items.some((item) => item.id !== id && item.parent?.type === parent.type && item.parent?.id === parent.id)) return items;
  let changed = false;
  const next = items.map((item) => {
    if (item.id !== id || (item.parent?.type === parent.type && item.parent?.id === parent.id)) return item;
    changed = true;
    return { ...item, parent: { type: parent.type, id: parent.id }, updatedAt: now.toISOString() };
  });
  return changed ? next : items;
}

export function sendBreakdownStepToLane(
  tasks,
  breakdown,
  lane,
  { occupiedNow = "cancel", now = new Date() } = {},
) {
  const step = firstIncompleteStep(breakdown);
  if (!step || (lane === "now" && getNowTask(tasks) && occupiedNow !== "move-to-next")) {
    return tasks;
  }
  const task = createToolTask(
    { text: step.text, lane },
    { id: `task:breakdown:${breakdown.id}:${step.id}`, now },
  );
  if (!task || tasks.some((item) => item.id === task.id)) return tasks;
  let next = addToolTask(tasks, task);
  if (next === tasks && lane === "now" && occupiedNow === "move-to-next") {
    const currentNow = getNowTask(tasks);
    const timestamp = now.toISOString();
    next = tasks.map((item) =>
      item.id === currentNow.id
        ? { ...item, lane: "next", updatedAt: timestamp }
        : item,
    );
    next = addToolTask(next, task);
  }
  return next;
}
