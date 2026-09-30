import { TASK_LANES } from "./constants.js";
import {
  isValidToolsId,
  normalizeText,
  normalizeToolsTimestamp,
} from "./utils.js";

const laneSet = new Set(TASK_LANES);

export function normalizeToolTask(value) {
  const text = normalizeText(value?.text);
  const createdAt = normalizeToolsTimestamp(value?.createdAt);
  const updatedAt = normalizeToolsTimestamp(value?.updatedAt);
  const completedAt =
    value?.completedAt === null
      ? null
      : normalizeToolsTimestamp(value?.completedAt);

  if (
    !isValidToolsId(value?.id) ||
    !text ||
    !laneSet.has(value?.lane) ||
    !createdAt ||
    !updatedAt ||
    (value?.completedAt !== null && !completedAt)
  ) {
    return null;
  }

  return {
    id: value.id,
    text,
    lane: value.lane,
    createdAt,
    updatedAt,
    completedAt,
  };
}

export function normalizeToolTasks(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  let hasNow = false;

  return value.reduce((tasks, item) => {
    const task = normalizeToolTask(item);
    if (!task || ids.has(task.id)) return tasks;
    if (task.lane === "now" && task.completedAt === null) {
      if (hasNow) return tasks;
      hasNow = true;
    }
    ids.add(task.id);
    tasks.push(task);
    return tasks;
  }, []);
}

export function createToolTask(input, metadata = {}) {
  const now = new Date(metadata.now ?? Date.now());
  if (Number.isNaN(now.getTime())) return null;
  const timestamp = now.toISOString();

  return normalizeToolTask({
    id: metadata.id,
    text: input?.text,
    lane: input?.lane,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  });
}

export function getLaneTasks(tasks, lane) {
  return tasks.filter(
    (task) => task.lane === lane && task.completedAt === null,
  );
}

export function getNowTask(tasks) {
  return getLaneTasks(tasks, "now")[0] ?? null;
}

export function addToolTask(tasks, task) {
  if (
    !task ||
    tasks.some((item) => item.id === task.id) ||
    (task.lane === "now" && getNowTask(tasks))
  ) {
    return tasks;
  }
  return [...tasks, task];
}

export function editToolTask(tasks, id, text, now = new Date()) {
  const nextText = normalizeText(text);
  const index = tasks.findIndex((task) => task.id === id);
  if (!nextText || index === -1 || Number.isNaN(now.getTime())) return tasks;
  if (tasks[index].text === nextText) return tasks;

  const next = [...tasks];
  next[index] = {
    ...tasks[index],
    text: nextText,
    updatedAt: now.toISOString(),
  };
  return next;
}

export function moveToolTask(
  tasks,
  id,
  lane,
  { occupiedNow = "cancel", now = new Date() } = {},
) {
  if (!laneSet.has(lane) || Number.isNaN(now.getTime())) return tasks;
  const target = tasks.find(
    (task) => task.id === id && task.completedAt === null,
  );
  if (!target || target.lane === lane) return tasks;

  const currentNow = lane === "now" ? getNowTask(tasks) : null;
  if (currentNow && currentNow.id !== id && occupiedNow !== "move-to-next") {
    return tasks;
  }

  const timestamp = now.toISOString();
  return tasks.map((task) => {
    if (task.id === target.id) {
      return { ...task, lane, updatedAt: timestamp };
    }
    if (currentNow && task.id === currentNow.id) {
      return { ...task, lane: "next", updatedAt: timestamp };
    }
    return task;
  });
}

export function completeToolTask(
  tasks,
  id,
  { promoteNext = false, now = new Date() } = {},
) {
  const target = tasks.find((task) => task.id === id);
  if (!target || target.completedAt !== null || Number.isNaN(now.getTime())) {
    return tasks;
  }

  const timestamp = now.toISOString();
  const nextToPromote =
    promoteNext && target.lane === "now" ? getLaneTasks(tasks, "next")[0] : null;

  return tasks.map((task) => {
    if (task.id === target.id) {
      return { ...task, completedAt: timestamp, updatedAt: timestamp };
    }
    if (nextToPromote && task.id === nextToPromote.id) {
      return { ...task, lane: "now", updatedAt: timestamp };
    }
    return task;
  });
}

export function deleteToolTask(tasks, id) {
  if (!tasks.some((task) => task.id === id)) return tasks;
  return tasks.filter((task) => task.id !== id);
}

export function reorderLaneTask(tasks, lane, id, direction) {
  if (!laneSet.has(lane) || ![-1, 1].includes(direction)) return tasks;
  const indexes = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.lane === lane && task.completedAt === null)
    .map(({ index }) => index);
  const currentPosition = indexes.findIndex((index) => tasks[index].id === id);
  const swapPosition = currentPosition + direction;
  if (currentPosition === -1 || swapPosition < 0 || swapPosition >= indexes.length) {
    return tasks;
  }

  const next = [...tasks];
  const currentIndex = indexes[currentPosition];
  const swapIndex = indexes[swapPosition];
  [next[currentIndex], next[swapIndex]] = [next[swapIndex], next[currentIndex]];
  return next;
}
