import { create } from "zustand";

import { getToday } from "@/shared/date";
import {
  getStorageOwner,
  saveData,
  loadData,
  subscribeStorageOwner,
} from "@/shared/storage";
import { useToast } from "@/ui/useToast";
import { syncToCloud, loadFromCloud } from "@core/cloudSync";
import { useAuth } from "@core/auth/store";
import { hasMatchingOwnership } from "@core/auth/ownership";
import { saveFocusSession, loadFocusSessions } from "./service";
import { mergeFocusSessions, normalizeFocusSessions } from "./utils";
import {
  createFocusOwnerState,
  finishFocusRuntime,
  pauseFocusRuntime,
  refreshFocusRuntime,
  resumeFocusRuntime,
  startFocusRuntime,
} from "./runtime";

const loadLocalSessions = () =>
  normalizeFocusSessions(loadData("echelon_focus", null)?.data);

const hasOwnedAccess = (owner) => hasMatchingOwnership(
  useAuth.getState().user?.uid ?? null,
  getStorageOwner(),
  owner,
);

export const useFocus = create((set, get) => ({
  ...createFocusOwnerState(getStorageOwner(), loadLocalSessions()),

  start: (task, now = Date.now()) => {
    if (!hasOwnedAccess(get().owner)) return false;
    useToast.getState().show("Focus started");

    set(startFocusRuntime(task, now));
    return true;
  },

  pause: (now = Date.now()) => {
    if (!hasOwnedAccess(get().owner)) return false;
    const current = get();
    const paused = pauseFocusRuntime(current, now);
    if (paused === current) return false;
    set(paused);
    return true;
  },

  resume: (now = Date.now()) => {
    if (!hasOwnedAccess(get().owner)) return false;
    const current = get();
    const resumed = resumeFocusRuntime(current, now);
    if (resumed === current) return false;
    set(resumed);
    return true;
  },

  stop: (now = Date.now()) => {
    if (!hasOwnedAccess(get().owner)) return false;
    const state = get();
    const result = finishFocusRuntime(state, now);

    if (!result.completed) {
      set(result.runtime);
      useToast.getState().show("Focus session too short");
      return false;
    }

    const completedAt = new Date(now);
    const session = {
      id:
        globalThis.crypto?.randomUUID?.() ||
        `${completedAt.getTime()}-${Math.random().toString(36).slice(2)}`,
      task: result.task.title,
      category: result.task.category,
      duration: result.duration,
      date: completedAt.toISOString(),
      dayKey: getToday(completedAt),
    };
    const sessions = [...state.sessions, session];

    const persisted = saveData("echelon_focus", {
      date: getToday(completedAt),
      data: sessions,
    });
    if (!persisted) return false;

    syncToCloud("focus", (uid) => saveFocusSession(uid, session));
    useToast.getState().show("Focus session saved");
    set({ ...result.runtime, sessions });
    return true;
  },

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadFocusSessions(uid),
      async (sessions, uid) => {
        if (!Array.isArray(sessions)) return;
        if (!hasOwnedAccess(useFocus.getState().owner) || getStorageOwner() !== uid) {
          return;
        }

        const merged = mergeFocusSessions(
          sessions,
          useFocus.getState().sessions,
        );

        const cloudIds = new Set(
          sessions.map((session) => session?.id).filter(Boolean),
        );
        const missingFromCloud = merged.filter(
          (session) => !cloudIds.has(session.id),
        );

        const persisted = saveData("echelon_focus", {
          date: getToday(),
          data: merged,
        });
        if (!persisted) return;

        set({ sessions: merged });

        await Promise.all(
          missingFromCloud.map((session) => saveFocusSession(uid, session)),
        );
      },
    ),

  tick: (now = Date.now()) => {
    if (!hasOwnedAccess(get().owner)) return false;
    set((state) => refreshFocusRuntime(state, now));
    return true;
  },
}));

subscribeStorageOwner(() => {
  useFocus.setState(
    createFocusOwnerState(getStorageOwner(), loadLocalSessions()),
  );
});
