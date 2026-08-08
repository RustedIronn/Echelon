import { create } from "zustand";

import { saveData, loadData } from "@utils/storage";
import { getToday, isNewDay } from "@utils/date";
import { habits as defaultHabits } from "@data/habits";
import { syncToCloud, loadFromCloud } from "@utils/cloudSync";
import { saveHabits, loadHabits } from "@services/habits";

const createHabits = () =>
  defaultHabits.map((name) => ({
    name,
    done: false,
  }));

const saved = loadData("echelon_habits", null);

export const useHabits = create((set) => ({
  habits: saved && !isNewDay(saved.date) ? saved.data : createHabits(),

  toggleHabit: (name) =>
    set((state) => {
      const habits = state.habits.map((habit) =>
        habit.name === name
          ? {
              ...habit,
              done: !habit.done,
            }
          : habit,
      );

      const data = {
        date: getToday(),
        data: habits,
      };

      saveData("echelon_habits", data);
      syncToCloud((uid) => saveHabits(uid, getToday(), habits));

      return {
        habits,
      };
    }),

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadHabits(uid, getToday()),
      (cloud) => {
        set({ habits: cloud.data });
        saveData("echelon_habits", cloud);
      },
    ),
}));
