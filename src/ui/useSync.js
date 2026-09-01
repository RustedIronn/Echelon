import { create } from "zustand";

export const useSync = create((set) => ({
  status: "idle",

  setSyncing: () =>
    set({
      status: "syncing",
    }),

  setSynced: () =>
    set({
      status: "synced",
    }),

  setSyncError: () =>
    set({
      status: "error",
    }),

  resetSync: () =>
    set({
      status: "idle",
    }),
}));
