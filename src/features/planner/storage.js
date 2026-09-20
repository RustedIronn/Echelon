import { loadData, saveData } from "@/shared/storage";
import { PLANNER_STORAGE_KEY, PLANNER_VERSION } from "./constants";
import { normalizePlannerTasks } from "./tasks";

export function createEmptyPlannerDocument() {
  return { version: PLANNER_VERSION, tasks: [] };
}

export function normalizePlannerDocument(value) {
  if (!value || value.version !== PLANNER_VERSION) return createEmptyPlannerDocument();
  return { version: PLANNER_VERSION, tasks: normalizePlannerTasks(value.tasks) };
}

export function loadPlannerDocument() {
  return normalizePlannerDocument(loadData(PLANNER_STORAGE_KEY, null));
}

export function savePlannerDocument(value) {
  const document = normalizePlannerDocument(value);
  return saveData(PLANNER_STORAGE_KEY, document) ? document : null;
}
