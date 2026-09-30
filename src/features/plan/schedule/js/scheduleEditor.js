import { isValidSchedule, normalizeSchedule } from "./scheduleDefaults.js";

export function createScheduleDraft(schedule) {
  return normalizeSchedule(schedule).map((task) => ({ ...task }));
}

export function updateScheduleDraft(draft, id, patch) {
  if (!Array.isArray(draft)) return draft;

  return draft.map((task) =>
    task.id === id ? { ...task, ...patch } : task,
  );
}

export function prepareScheduleCommit(draft) {
  return isValidSchedule(draft) ? normalizeSchedule(draft) : null;
}

export function getScheduleEditorKey({ owner, revision, updatedAt }) {
  return `${owner ?? "none"}:${revision}:${updatedAt ?? "legacy"}`;
}
