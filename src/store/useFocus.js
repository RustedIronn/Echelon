import { create } from "zustand";

import { getToday } from "@utils/date";
import { saveData, loadData } from "@utils/storage";
import { useToast } from "./useToast";
import { syncToCloud, loadFromCloud } from "@utils/cloudSync";
import { saveFocusSession, loadFocusSessions } from "@services/focus";

export const useFocus = create((set) => ({
  active: false,
  task: null,
  seconds: 0,

  sessions:
    loadData("echelon_focus", {
      date: getToday(),
      data: [],
    }).data || [],

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
      (sessions) => {
        // preserve original semantic: don't clobber local with an empty cloud result
        if (!sessions.length) return;

        set({ sessions });

        saveData("echelon_focus", {
          date: getToday(),
          data: sessions,
        });
      },
    ),

  tick: () =>
    set((state) => ({
      seconds: state.seconds + 1,
    })),
}));
