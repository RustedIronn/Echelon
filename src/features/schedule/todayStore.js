import { create } from "zustand";

import { saveData, loadData } from "@/shared/storage";
import { getToday } from "@/shared/date";
import { schedule as defaultSchedule } from "./constants";
import { useToast } from "@/ui/useToast";
import { syncToCloud, loadFromCloud } from "@core/cloudSync";
import { saveDaily, loadDaily } from "./todayService";

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

  // clears today's checkmarks without reloading the schedule template —
  // distinct from refreshSchedule, which also pulls in any schedule edits.
  // was missing entirely after the phase-3 rewrite, which broke ResetDay.jsx.
  resetDay: () =>
    set((state) => {
      const tasks = state.tasks.map((task) => ({
        ...task,
        done: false,
      }));

      const data = {
        date: getToday(),
        tasks,
      };

      saveData("echelon_today", data);
      syncToCloud((uid) => saveDaily(uid, getToday(), data));

      return {
        tasks,
      };
    }),

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadDaily(uid, getToday()),
      (cloud) => {
        set({ tasks: cloud.tasks });
        saveData("echelon_today", cloud);
      },
    ),
}));
