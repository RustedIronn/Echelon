import { create } from "zustand";

import { saveData, loadData } from "@utils/storage";
import { getToday } from "@utils/date";
import { schedule as defaultSchedule } from "@data/schedule";
import { useToast } from "./useToast";
import { syncToCloud, loadFromCloud } from "@utils/cloudSync";
import { saveDaily, loadDaily } from "@services/daily";

const getTasks = () => {
  const schedule = loadData("echelon_schedule", defaultSchedule);

  return schedule.map((task) => ({
    ...task,
    done: false,
  }));
};

const saved = loadData("echelon_today", null);

export const useToday = create((set) => ({
  tasks: saved?.date === getToday() ? saved.tasks : getTasks(),

  toggleTask: (id) =>
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

      const data = {
        date: getToday(),
        tasks,
      };

      saveData("echelon_today", data);
      syncToCloud((uid) => saveDaily(uid, getToday(), data));

      useToast
        .getState()
        .show(currentTask?.done ? "Task reopened" : "Task completed");

      return {
        tasks,
      };
    }),

  refreshSchedule: () => {
    const tasks = getTasks();

    const data = {
      date: getToday(),
      tasks,
    };

    saveData("echelon_today", data);
    syncToCloud((uid) => saveDaily(uid, getToday(), data));

    set({
      tasks,
    });
  },

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadDaily(uid, getToday()),
      (cloud) => {
        set({ tasks: cloud.tasks });
        saveData("echelon_today", cloud);
      },
    ),
}));
