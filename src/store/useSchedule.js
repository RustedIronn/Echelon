import { create } from "zustand";

import { schedule as defaultSchedule } from "@data/schedule";

import { saveData, loadData } from "@utils/storage";

import { useAuth } from "@store/useAuth";

import { saveSchedule, loadSchedule } from "@services/schedule";

export const useSchedule = create((set) => ({
  schedule: loadData("lockin_schedule", defaultSchedule),

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

      saveData("lockin_schedule", updated);

      const user = useAuth.getState().user;

      if (user) {
        saveSchedule(user.uid, updated).catch(console.error);
      }

      return {
        schedule: updated,
      };
    }),

  loadFromCloud: async () => {
    const user = useAuth.getState().user;

    if (!user) return;

    try {
      const cloud = await loadSchedule(user.uid);

      if (cloud) {
        set({
          schedule: cloud,
        });

        saveData("lockin_schedule", cloud);
      }
    } catch (error) {
      console.error("Schedule sync failed:", error);
    }
  },
}));
