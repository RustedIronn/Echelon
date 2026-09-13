import { create } from "zustand";

import { getToday } from "@/shared/date";
import { saveData, loadData, subscribeStorageOwner } from "@/shared/storage";
import { useToast } from "@/ui/useToast";
import { syncToCloud, loadFromCloud } from "@core/cloudSync";
import { saveFocusSession, loadFocusSessions } from "./service";
import { mergeFocusSessions, normalizeFocusSessions } from "./utils";

const loadLocalSessions = () =>
  normalizeFocusSessions(loadData("echelon_focus", null)?.data);

export const useFocus = create((set) => ({
  active: false,
  task: null,
  seconds: 0,

  sessions: loadLocalSessions(),

  start: (task) => {
    useToast.getState().show("Focus started");

    set({
      active: true,
      task,
      seconds: 0,
    });
  },

  stop: () => {
    set((state) => {
      if (!state.task || state.seconds === 0) {
        useToast.getState().show("Focus session too short");

        return {
          active: false,
          task: null,
          seconds: 0,
        };
      }

      const session = {
        id:
          globalThis.crypto?.randomUUID?.() ||
          `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        task: state.task.title,
        category: state.task.category,
        duration: state.seconds,
        date: new Date().toISOString(),
      };

      const sessions = [...state.sessions, session];

      saveData("echelon_focus", {
        date: getToday(),
        data: sessions,
      });

      syncToCloud((uid) => saveFocusSession(uid, session));

      useToast.getState().show("Focus session saved");

      return {
        active: false,
        task: null,
        seconds: 0,
        sessions,
      };
    });
  },

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadFocusSessions(uid),
      async (sessions, uid) => {
        if (!Array.isArray(sessions)) return;

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

        set({ sessions: merged });

        saveData("echelon_focus", {
          date: getToday(),
          data: merged,
        });

        await Promise.all(
          missingFromCloud.map((session) => saveFocusSession(uid, session)),
        );
      },
    ),

  tick: () =>
    set((state) => ({
      seconds: state.seconds + 1,
    })),
}));

subscribeStorageOwner(() => {
  useFocus.setState({
    active: false,
    task: null,
    seconds: 0,
    sessions: loadLocalSessions(),
  });
});
