import { create } from "zustand";

import { getToday } from "@utils/date";

import { saveData, loadData } from "@utils/storage";

import { useToast } from "./useToast";

import { useAuth } from "@store/useAuth";

import { saveFocusSession, loadFocusSessions } from "@services/focus";

export const useFocus = create((set) => ({
  active: false,

  task: null,

  seconds: 0,

  sessions:
    loadData("lockin_focus", {
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

      saveData("lockin_focus", {
        date: getToday(),
        data: sessions,
      });

      const user = useAuth.getState().user;

      if (user) {
        saveFocusSession(user.uid, session).catch(console.error);
      }

      useToast.getState().show("Focus session saved");

      return {
        active: false,

        task: null,

        seconds: 0,

        sessions,
      };
    });
  },

  loadFromCloud: async () => {
    const user = useAuth.getState().user;

    if (!user) return;

    try {
      const sessions = await loadFocusSessions(user.uid);

      if (sessions.length) {
        set({
          sessions,
        });

        saveData("lockin_focus", {
          date: getToday(),
          data: sessions,
        });
      }
    } catch (error) {
      console.error("Focus sync failed:", error);
    }
  },

  tick: () =>
    set((state) => ({
      seconds: state.seconds + 1,
    })),
}));
