import { getCurrentScheduleItem } from "@features/schedule/time";

export function getPrimaryMission(tasks, now = new Date()) {
  if (!Array.isArray(tasks)) return null;

  const current = getCurrentScheduleItem(tasks, now);
  if (current && !current.done) return current;

  return tasks.find((task) => !task.done) ?? null;
}

export function getMissionQueue(tasks, now = new Date()) {
  const primary = getPrimaryMission(tasks, now);
  if (!Array.isArray(tasks)) return [];

  return tasks.filter((task) => !task.done && task.id !== primary?.id);
}
