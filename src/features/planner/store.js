import { create } from "zustand";

import { hasMatchingOwnership } from "@core/auth/ownership";
import { useAuth } from "@core/auth/store";
import { getStorageOwner, subscribeStorageOwner } from "@/shared/storage";
import { loadPlannerDocument, savePlannerDocument } from "./storage";
import {
  addPlannerTask,
  createPlannerTask,
  deletePlannerTask,
  reschedulePlannerTask,
  setPlannerTaskPriority,
  plannerTaskFromLegacyLane,
  togglePlannerTask,
} from "./tasks";

const hasOwnedAccess = (owner) => hasMatchingOwnership(
  useAuth.getState().user?.uid ?? null,
  getStorageOwner(),
  owner,
);

const commit = (set, document) => {
  const persisted = savePlannerDocument(document);
  if (!persisted) return false;
  set({ document: persisted });
  return true;
};

export const usePlanner = create((set, get) => ({
  owner: getStorageOwner(),
  document: loadPlannerDocument(),

  addTask: (input, metadata = {}) => {
    const state = get();
    if (!hasOwnedAccess(state.owner)) return false;
    const task = createPlannerTask(input, metadata);
    if (!task) return false;
    const tasks = addPlannerTask(state.document.tasks, task);
    return tasks === state.document.tasks ? false : commit(set, { ...state.document, tasks });
  },

  importLegacyLaneTask: (legacyTask) => {
    const state = get();
    if (!hasOwnedAccess(state.owner)) return false;
    const task = plannerTaskFromLegacyLane(legacyTask);
    if (!task) return false;
    if (state.document.tasks.some((item) => item.id === task.id)) return true;
    return commit(set, { ...state.document, tasks: [...state.document.tasks, task] });
  },

  toggleTask: (id, now = new Date()) => {
    const state = get();
    if (!hasOwnedAccess(state.owner)) return false;
    const tasks = togglePlannerTask(state.document.tasks, id, now);
    return tasks === state.document.tasks ? false : commit(set, { ...state.document, tasks });
  },

  rescheduleTask: (id, date, time = null, now = new Date()) => {
    const state = get();
    if (!hasOwnedAccess(state.owner)) return false;
    const tasks = reschedulePlannerTask(state.document.tasks, id, date, time, now);
    return tasks === state.document.tasks ? false : commit(set, { ...state.document, tasks });
  },

  setPriority: (id, priority, now = new Date()) => {
    const state = get();
    if (!hasOwnedAccess(state.owner)) return false;
    const tasks = setPlannerTaskPriority(state.document.tasks, id, priority, now);
    return tasks === state.document.tasks ? false : commit(set, { ...state.document, tasks });
  },

  deleteTask: (id) => {
    const state = get();
    if (!hasOwnedAccess(state.owner)) return false;
    const tasks = deletePlannerTask(state.document.tasks, id);
    return tasks === state.document.tasks ? false : commit(set, { ...state.document, tasks });
  },
}));

subscribeStorageOwner(() => {
  usePlanner.setState({ owner: getStorageOwner(), document: loadPlannerDocument() });
});
