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
import { saveDaily, loadDaily } from "./todayService";

const getTasks = () => {
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
  tasks: document?.tasks ?? getTasks(),
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
    set((state) => {
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

      saveData("echelon_today", document);
      syncToCloud((uid) => saveDaily(uid, getToday(), document));

      useToast
        .getState()
        .show(currentTask?.done ? "Task reopened" : "Task completed");

      return {
        tasks,
        revision: document.revision,
        updatedAt: document.updatedAt,
      };
    });
    return true;
  },

  refreshSchedule: () => {
    if (!hasOwnedAccess(get().owner)) return false;
    const tasks = getTasks();

    const state = useToday.getState();
    const document = createNextRevision({
      date: getToday(),
      tasks,
    }, state);

    saveData("echelon_today", document);
    syncToCloud((uid) => saveDaily(uid, getToday(), document));

    set({
      tasks,
      revision: document.revision,
      updatedAt: document.updatedAt,
    });
    return true;
  },

  // clears today's checkmarks without reloading the schedule template —
  // distinct from refreshSchedule, which also pulls in any schedule edits.
  // was missing entirely after the phase-3 rewrite, which broke ResetDay.jsx.
  resetDay: () => {
    if (!hasOwnedAccess(get().owner)) return false;
    set((state) => {
      const tasks = state.tasks.map((task) => ({
        ...task,
        done: false,
      }));

      const document = createNextRevision({
        date: getToday(),
        tasks,
      }, state);

      saveData("echelon_today", document);
      syncToCloud((uid) => saveDaily(uid, getToday(), document));

      return {
        tasks,
        revision: document.revision,
        updatedAt: document.updatedAt,
      };
    });
    return true;
  },

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadDaily(uid, getToday()),
      async (cloud, uid) => {
        const resolution = await reconcileVersionedState({
          local: loadLocalDocument(),
          cloud: normalizeDocument(cloud),
          selectContent: ({ date, tasks }) => ({ date, tasks }),
          uploadLocal: (document) => saveDaily(uid, getToday(), document),
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

        saveData("echelon_today", resolution.value);
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
