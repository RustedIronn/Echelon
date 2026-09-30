import { addToolTask, createToolTask, getNowTask } from "./tasks.js";
import {
  isValidToolsId,
  normalizeText,
  normalizeToolsTimestamp,
} from "./utils.js";

export function normalizeBrainDumpItem(value) {
  const text = normalizeText(value?.text);
  const createdAt = normalizeToolsTimestamp(value?.createdAt);
  const updatedAt = normalizeToolsTimestamp(value?.updatedAt);
  if (!isValidToolsId(value?.id) || !text || !createdAt || !updatedAt) {
    return null;
  }
  return { id: value.id, text, createdAt, updatedAt };
}

export function normalizeBrainDump(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.reduce((items, entry) => {
    const item = normalizeBrainDumpItem(entry);
    if (!item || ids.has(item.id)) return items;
    ids.add(item.id);
    items.push(item);
    return items;
  }, []);
}

export function createBrainDumpItems(text, metadata = {}) {
  const now = new Date(metadata.now ?? Date.now());
  if (!isValidToolsId(metadata.batchId) || Number.isNaN(now.getTime())) return [];
  const timestamp = now.toISOString();
  const seen = new Set();

  return String(text ?? "")
    .split(/\r?\n/)
    .map(normalizeText)
    .filter((line) => line && !seen.has(line.toLowerCase()) && seen.add(line.toLowerCase()))
    .map((line, index) => ({
      id: `${metadata.batchId}:${index}`,
      text: line,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
}

export function addBrainDumpItems(items, additions) {
  const ids = new Set(items.map((item) => item.id));
  const fresh = additions.filter((item) => item && !ids.has(item.id));
  return fresh.length ? [...items, ...fresh] : items;
}

export function deleteBrainDumpItem(items, id) {
  if (!items.some((item) => item.id === id)) return items;
  return items.filter((item) => item.id !== id);
}

export function promoteBrainDumpItem(
  tasks,
  items,
  id,
  lane,
  { occupiedNow = "cancel", now = new Date() } = {},
) {
  const item = items.find((entry) => entry.id === id);
  if (!item || (lane === "now" && getNowTask(tasks) && occupiedNow !== "move-to-next")) {
    return { tasks, brainDump: items, changed: false };
  }

  const task = createToolTask(
    { text: item.text, lane },
    { id: `task:brain:${item.id}`, now },
  );
  if (!task || tasks.some((entry) => entry.id === task.id)) {
    return { tasks, brainDump: items, changed: false };
  }
  let nextTasks = addToolTask(tasks, task);
  if (nextTasks === tasks && lane === "now" && occupiedNow === "move-to-next") {
    const currentNow = getNowTask(tasks);
    const timestamp = now.toISOString();
    nextTasks = tasks.map((entry) =>
      entry.id === currentNow.id
        ? { ...entry, lane: "next", updatedAt: timestamp }
        : entry,
    );
    nextTasks = addToolTask(nextTasks, task);
  }
  if (nextTasks === tasks) return { tasks, brainDump: items, changed: false };

  return {
    tasks: nextTasks,
    brainDump: items.filter((entry) => entry.id !== id),
    changed: true,
  };
}
