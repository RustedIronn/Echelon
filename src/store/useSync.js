import { create } from "zustand";

export const useSync = create((set) => ({
  syncing: false,

  synced: false,

  setSyncing: (syncing) =>
    set({
      syncing,
    }),

  setSynced: (synced) =>
    set({
      synced,
    }),
}));
