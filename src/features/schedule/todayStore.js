import { create } from "zustand";

import {
  getStorageOwner,
  saveData,
  loadData,
  subscribeStorageOwner,
} from "@/shared/storage";
import { getToday } from "@/shared/date";
import {
  createNextRevision,
  reconcileVersionedState,
} from "@/shared/versionedState";
import {
  normalizeSchedule,
  normalizeDailyTasks,
} from "./constants";
import { useToast } from "@/ui/useToast";
import { syncToCloud, loadFromCloud } from "@core/cloudSync";
import { useAuth } from "@core/auth/store";
import { hasMatchingOwnership } from "@core/auth/ownership";
import { loadTodayCloud, saveTodayCloud } from "./service";

const createTodayTasksFromSchedule = () => {
  const stored = loadData("echelon_schedule", null);
  const storedSchedule = Array.isArray(stored) ? stored : stored?.schedule;
  const schedule = normalizeSchedule(storedSchedule);

  return schedule.map((task) => ({
    ...task,
    done: false,
  }));
};

const normalizeDocument = (value) => {
  const tasks = normalizeDailyTasks(value?.tasks);

  if (!tasks || value.date !== getToday()) return null;

  return {
    ...value,
    tasks,
    revision: Number.isInteger(value.revision) ? value.revision : 0,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
};

const loadLocalDocument = () =>
  normalizeDocument(loadData("echelon_today", null));

const initialDocument = loadLocalDocument();
const stateFromDocument = (document) => ({
  tasks: document?.tasks ?? createTodayTasksFromSchedule(),
  revision: document?.revision ?? 0,
  updatedAt: document?.updatedAt ?? null,
});

const hasOwnedAccess = (owner) => hasMatchingOwnership(
  useAuth.getState().user?.uid ?? null,
  getStorageOwner(),
  owner,
);

export const useToday = create((set, get) => ({
  owner: getStorageOwner(),
  ...stateFromDocument(initialDocument),

  rolloverDay: () => {
    set(stateFromDocument(loadLocalDocument()));
    return useToday.getState().loadFromCloud();
  },

  toggleTask: (id) => {
    if (!hasOwnedAccess(get().owner)) return false;
    const state = get();
    const currentTask = state.tasks.find((task) => task.id === id);
    const tasks = state.tasks.map((task) =>
      task.id === id
        ? {
            ...task,
            done: !task.done,
          }
        : task,
    );
    const document = createNextRevision({
      date: getToday(),
      tasks,
    }, state);

    if (!saveData("echelon_today", document)) return false;

    set({
      tasks,
      revision: document.revision,
      updatedAt: document.updatedAt,
    });
    syncToCloud("today", (uid) => saveTodayCloud(uid, getToday(), document));
    useToast
      .getState()
      .show(currentTask?.done ? "Task reopened" : "Task completed");
    return true;
  },

  refreshSchedule: () => {
    if (!hasOwnedAccess(get().owner)) return false;
    const tasks = createTodayTasksFromSchedule();

    const state = useToday.getState();
    const document = createNextRevision({
      date: getToday(),
      tasks,
    }, state);

    if (!saveData("echelon_today", document)) return false;
    syncToCloud("today", (uid) => saveTodayCloud(uid, getToday(), document));

    set({
      tasks,
      revision: document.revision,
      updatedAt: document.updatedAt,
    });
    return true;
  },

  // Clear today's checkmarks without pulling later Schedule edits into the
  // current day; refreshSchedule intentionally performs both operations.
  resetDay: () => {
    if (!hasOwnedAccess(get().owner)) return false;
    const state = get();
    const tasks = state.tasks.map((task) => ({
      ...task,
      done: false,
    }));
    const document = createNextRevision({
      date: getToday(),
      tasks,
    }, state);

    if (!saveData("echelon_today", document)) return false;

    set({
      tasks,
      revision: document.revision,
      updatedAt: document.updatedAt,
    });
    syncToCloud("today", (uid) => saveTodayCloud(uid, getToday(), document));
    return true;
  },

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadTodayCloud(uid, getToday()),
      async (cloud, uid) => {
        const resolution = await reconcileVersionedState({
          local: loadLocalDocument(),
          cloud: normalizeDocument(cloud),
          selectContent: ({ date, tasks }) => ({ date, tasks }),
          uploadLocal: (document) => saveTodayCloud(uid, getToday(), document),
        });

        if (
          !resolution.value ||
          !hasMatchingOwnership(
            useAuth.getState().user?.uid ?? null,
            getStorageOwner(),
            useToday.getState().owner,
          ) ||
          useToday.getState().owner !== uid
        ) return;

        if (!saveData("echelon_today", resolution.value)) return;
        set(stateFromDocument(resolution.value));
      },
      { applyNull: true },
    ),
}));

subscribeStorageOwner(() => {
  useToday.setState({
    owner: getStorageOwner(),
    ...stateFromDocument(loadLocalDocument()),
  });
});
