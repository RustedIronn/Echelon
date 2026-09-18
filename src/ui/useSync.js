import { create } from "zustand";

export const SYNC_SOURCES = Object.freeze([
  "bootstrap",
  "money",
  "review",
]);

const SYNC_STATUSES = new Set(["idle", "syncing", "synced", "error"]);

export const createSyncSourceState = () => Object.fromEntries(
  SYNC_SOURCES.map((source) => [source, "idle"]),
);

export function deriveSyncStatus(sources) {
  const statuses = SYNC_SOURCES.map((source) => sources?.[source] ?? "idle");

  if (statuses.includes("error")) return "error";
  if (statuses.includes("syncing")) return "syncing";
  if (statuses.includes("synced")) return "synced";
  return "idle";
}

const createOwnedSyncState = (ownerUid = null) => {
  const sources = createSyncSourceState();
  return { ownerUid, sources, status: deriveSyncStatus(sources) };
};

export const useSync = create((set, get) => ({
  ...createOwnedSyncState(),

  setSyncStatus: (source, status, operationUid) => {
    if (
      !SYNC_SOURCES.includes(source) ||
      !SYNC_STATUSES.has(status) ||
      !operationUid ||
      get().ownerUid !== operationUid
    ) return false;

    const current = get().sources;
    if (current[source] === status) return true;

    const sources = { ...current, [source]: status };
    set({ sources, status: deriveSyncStatus(sources) });
    return true;
  },

  resetSync: (ownerUid = null) => set(createOwnedSyncState(ownerUid)),
}));
