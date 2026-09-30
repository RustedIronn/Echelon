import { create } from "zustand";
import { hasMatchingOwnership } from "../../../core/auth/ownership.js";
import { useAuth } from "../../../core/auth/state.js";

import {
  getStorageOwner,
  subscribeStorageOwner,
} from "../../../shared/storage.js";
import {
  addBrainDumpItems,
  createBrainDumpItems,
  deleteBrainDumpItem,
  normalizeBrainDumpItem,
  promoteBrainDumpItem,
} from "./brainDump.js";
import {
  attachBreakdown,
  addBreakdown,
  addBreakdownStep,
  createBreakdown,
  deleteBreakdown,
  firstIncompleteStep,
  removeBreakdownStep,
  renameBreakdown,
  reorderBreakdownStep,
  sendBreakdownStepToLane,
  toggleBreakdownStep,
} from "./breakdowns.js";
import { DEFAULT_RESET_STEPS } from "./constants.js";
import { createNote, setNoteArchived, updateNote } from "./notes.js";
import { defaultResetPreferences, editResetStep } from "./reset.js";
import { loadToolsDocument, saveToolsDocument } from "./storage.js";
import {
  addToolTask,
  completeToolTask,
  createToolTask,
  deleteToolTask,
  editToolTask,
  getNowTask,
  moveToolTask,
  reorderLaneTask,
} from "./tasks.js";
import {
  finishAwarenessTimer,
  IDLE_TIMER,
  pauseAwarenessTimer,
  resetAwarenessTimer,
  resumeAwarenessTimer,
  startAwarenessTimer,
} from "./timer.js";
import { createToolsId } from "./utils.js";

const getOwnedData = (get) => {
  const owner = getStorageOwner();
  const state = get();
  return hasMatchingOwnership(useAuth.getState().user?.uid ?? null, owner, state.owner)
    ? state.data : null;
};

const commit = (set, data) => {
  const persisted = saveToolsDocument(data);
  if (!persisted) return false;
  set({ data: persisted });
  return true;
};

export const useTools = create((set, get) => ({
  owner: getStorageOwner(),
  data: loadToolsDocument(),
  timer: IDLE_TIMER,

  addNote: (input, metadata = {}) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const note = createNote(input, { id: metadata.id ?? createToolsId("note"), now: metadata.now });
    if (!note || current.notes.some((item) => item.id === note.id)) return false;
    return commit(set, { ...current, notes: [...current.notes, note] });
  },

  updateNote: (id, patch, now = new Date()) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const notes = updateNote(current.notes, id, patch, now);
    return notes === current.notes ? false : commit(set, { ...current, notes });
  },

  archiveNote: (id, archived) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const notes = setNoteArchived(current.notes, id, archived);
    return notes === current.notes ? false : commit(set, { ...current, notes });
  },

  deleteNote: (id) => {
    const current = getOwnedData(get);
    if (!current || !current.notes.some((note) => note.id === id)) return false;
    return commit(set, { ...current, notes: current.notes.filter((note) => note.id !== id) });
  },

  markLaneMigrated: (id) => {
    const current = getOwnedData(get);
    if (!current || current.migratedLaneIds.includes(id) || !current.tasks.some((task) => task.id === id)) return false;
    return commit(set, { ...current, migratedLaneIds: [...current.migratedLaneIds, id] });
  },

  addTask: (input, metadata = {}) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const task = createToolTask(input, {
      id: metadata.id ?? createToolsId("task"),
      now: metadata.now,
    });
    const tasks = addToolTask(current.tasks, task);
    return tasks === current.tasks ? false : commit(set, { ...current, tasks });
  },

  editTask: (id, text, now = new Date()) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const tasks = editToolTask(current.tasks, id, text, now);
    return tasks === current.tasks ? false : commit(set, { ...current, tasks });
  },

  moveTask: (id, lane, options = {}) => {
    const current = getOwnedData(get);
    if (!current) return false;
    if (
      lane === "now" &&
      getNowTask(current.tasks) &&
      getNowTask(current.tasks).id !== id &&
      options.occupiedNow !== "move-to-next"
    ) {
      return "occupied-now";
    }
    const tasks = moveToolTask(current.tasks, id, lane, options);
    return tasks === current.tasks ? false : commit(set, { ...current, tasks });
  },

  completeTask: (id, options = {}) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const tasks = completeToolTask(current.tasks, id, options);
    return tasks === current.tasks ? false : commit(set, { ...current, tasks });
  },

  deleteTask: (id) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const tasks = deleteToolTask(current.tasks, id);
    return tasks === current.tasks ? false : commit(set, { ...current, tasks });
  },

  reorderTask: (lane, id, direction) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const tasks = reorderLaneTask(current.tasks, lane, id, direction);
    return tasks === current.tasks ? false : commit(set, { ...current, tasks });
  },

  captureBrainDump: (text, metadata = {}) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const items = createBrainDumpItems(text, {
      batchId: metadata.batchId ?? createToolsId("brain"),
      now: metadata.now,
    });
    const brainDump = addBrainDumpItems(current.brainDump, items);
    return brainDump === current.brainDump
      ? false
      : commit(set, { ...current, brainDump });
  },

  captureNote: (text, metadata = {}) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const timestamp = new Date(metadata.now ?? Date.now()).toISOString();
    const item = normalizeBrainDumpItem({
      id: metadata.id ?? createToolsId("note"),
      text,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    if (!item) return false;
    const brainDump = addBrainDumpItems(current.brainDump, [item]);
    return brainDump === current.brainDump ? false : commit(set, { ...current, brainDump });
  },

  deleteBrainDump: (id) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const brainDump = deleteBrainDumpItem(current.brainDump, id);
    return brainDump === current.brainDump
      ? false
      : commit(set, { ...current, brainDump });
  },

  promoteBrainDump: (id, lane, options = {}) => {
    const current = getOwnedData(get);
    if (!current) return false;
    if (lane === "now" && getNowTask(current.tasks) && options.occupiedNow !== "move-to-next") {
      return "occupied-now";
    }
    const result = promoteBrainDumpItem(
      current.tasks,
      current.brainDump,
      id,
      lane,
      options,
    );
    return result.changed
      ? commit(set, {
          ...current,
          tasks: result.tasks,
          brainDump: result.brainDump,
        })
      : false;
  },

  addBreakdown: (title, metadata = {}) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const breakdown = createBreakdown(title, {
      id: metadata.id ?? createToolsId("breakdown"),
      now: metadata.now,
      parent: metadata.parent,
    });
    const breakdowns = addBreakdown(current.breakdowns, breakdown);
    return breakdowns === current.breakdowns
      ? false
      : commit(set, { ...current, breakdowns });
  },

  renameBreakdown: (id, title, now = new Date()) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const breakdowns = renameBreakdown(current.breakdowns, id, title, now);
    return breakdowns === current.breakdowns
      ? false
      : commit(set, { ...current, breakdowns });
  },

  addBreakdownStep: (breakdownId, text, metadata = {}) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const stepText = typeof text === "string" ? text.trim() : "";
    if (!stepText) return false;
    const breakdowns = addBreakdownStep(
      current.breakdowns,
      breakdownId,
      {
        id: metadata.id ?? createToolsId("step"),
        text: stepText,
        completed: false,
      },
      new Date(metadata.now ?? Date.now()),
    );
    return breakdowns === current.breakdowns
      ? false
      : commit(set, { ...current, breakdowns });
  },

  removeBreakdownStep: (breakdownId, stepId) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const breakdowns = removeBreakdownStep(current.breakdowns, breakdownId, stepId);
    return breakdowns === current.breakdowns
      ? false
      : commit(set, { ...current, breakdowns });
  },

  toggleBreakdownStep: (breakdownId, stepId) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const breakdowns = toggleBreakdownStep(current.breakdowns, breakdownId, stepId);
    return breakdowns === current.breakdowns
      ? false
      : commit(set, { ...current, breakdowns });
  },

  reorderBreakdownStep: (breakdownId, stepId, direction) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const breakdowns = reorderBreakdownStep(
      current.breakdowns,
      breakdownId,
      stepId,
      direction,
    );
    return breakdowns === current.breakdowns
      ? false
      : commit(set, { ...current, breakdowns });
  },

  deleteBreakdown: (id) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const breakdowns = deleteBreakdown(current.breakdowns, id);
    return breakdowns === current.breakdowns
      ? false
      : commit(set, { ...current, breakdowns });
  },

  attachBreakdown: (id, parent) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const breakdowns = attachBreakdown(current.breakdowns, id, parent);
    return breakdowns === current.breakdowns ? false : commit(set, { ...current, breakdowns });
  },

  sendBreakdownStep: (breakdownId, lane, options = {}) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const breakdown = current.breakdowns.find((item) => item.id === breakdownId);
    if (!breakdown || !firstIncompleteStep(breakdown)) return false;
    if (lane === "now" && getNowTask(current.tasks) && options.occupiedNow !== "move-to-next") {
      return "occupied-now";
    }
    const tasks = sendBreakdownStepToLane(current.tasks, breakdown, lane, options);
    return tasks === current.tasks ? false : commit(set, { ...current, tasks });
  },

  editResetStep: (id, text) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const resetPreferences = editResetStep(current.resetPreferences, id, text);
    return resetPreferences === current.resetPreferences
      ? false
      : commit(set, { ...current, resetPreferences });
  },

  restoreResetSteps: () => {
    const current = getOwnedData(get);
    if (!current) return false;
    const resetPreferences = defaultResetPreferences();
    if (
      current.resetPreferences.steps.every(
        (step, index) =>
          step.id === DEFAULT_RESET_STEPS[index]?.id &&
          step.text === DEFAULT_RESET_STEPS[index]?.text,
      ) && current.resetPreferences.steps.length === DEFAULT_RESET_STEPS.length
    ) {
      return false;
    }
    return commit(set, { ...current, resetPreferences });
  },

  startTimer: (minutes, now = new Date()) => {
    if (!getOwnedData(get)) return false;
    const timer = startAwarenessTimer(minutes, now);
    if (timer.status === "idle") return false;
    set({ timer });
    return true;
  },
  pauseTimer: (now = new Date()) => set((state) => ({
    timer: pauseAwarenessTimer(state.timer, now),
  })),
  resumeTimer: (now = new Date()) => set((state) => ({
    timer: resumeAwarenessTimer(state.timer, now),
  })),
  finishTimer: (now = new Date()) => set((state) => ({
    timer: finishAwarenessTimer(state.timer, now),
  })),
  resetTimer: () => set({ timer: resetAwarenessTimer() }),
}));

subscribeStorageOwner(() => {
  useTools.setState({
    owner: getStorageOwner(),
    data: loadToolsDocument(),
    timer: IDLE_TIMER,
  });
});
