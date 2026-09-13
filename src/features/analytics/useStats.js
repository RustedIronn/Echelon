import { create } from "zustand";
import { saveData, loadData, subscribeStorageOwner } from "@/shared/storage";
import { getToday } from "@/shared/date";
import { normalizeProgressHistory } from "./insights";

const savedHistory = loadData("echelon_history", []);

export const useStats = create((set) => ({
  history: normalizeProgressHistory(savedHistory),

  saveDay: (progress) => {
    const today = getToday();
    const storedHistory = loadData("echelon_history", []);
    const history = normalizeProgressHistory(storedHistory);

    const updated = [
      ...history.filter((day) => day.date !== today),
      {
        date: today,
        progress,
      },
    ];

    const safeHistory = normalizeProgressHistory(updated);

    saveData("echelon_history", safeHistory);
    set({ history: safeHistory });
  },
}));

subscribeStorageOwner(() => {
  useStats.setState({
    history: normalizeProgressHistory(loadData("echelon_history", [])),
  });
});
