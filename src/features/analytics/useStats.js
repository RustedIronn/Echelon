import { create } from "zustand";
import { saveData, loadData } from "@/shared/storage";
import { getToday } from "@/shared/date";

export const useStats = create((set) => ({
  history: loadData("echelon_history", []),

  saveDay: (progress) => {
    const today = getToday();
    const history = loadData("echelon_history", []);

    const updated = [
      ...history.filter((day) => day.date !== today),
      {
        date: today,
        progress,
      },
    ];

    saveData("echelon_history", updated);
    set({ history: updated });
  },
}));
