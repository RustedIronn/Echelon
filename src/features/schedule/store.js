import { create } from "zustand";

import { schedule as defaultSchedule } from "./data";
import { saveData, loadData } from "@utils/storage";
import { syncToCloud, loadFromCloud } from "@core/cloudSync";
import { saveSchedule, loadSchedule } from "./service";

export const useSchedule = create((set) => ({
  schedule: loadData("echelon_schedule", defaultSchedule),

  updateTask: (id, data) =>
    set((state) => {
      const updated = state.schedule.map((task) =>
        task.id === id
          ? {
              ...task,
              ...data,
            }
          : task,
      );

      saveData("echelon_schedule", updated);
      syncToCloud((uid) => saveSchedule(uid, updated));

      return {
        schedule: updated,
      };
    }),

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadSchedule(uid),
      (cloud) => {
        set({ schedule: cloud });
        saveData("echelon_schedule", cloud);
      },
    ),
}));
