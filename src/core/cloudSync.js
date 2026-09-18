import { useAuth } from "./auth/store";
import { useSync } from "../ui/useSync";
import { getStorageOwner } from "../shared/storage";

// Background cloud write shared by legacy stores. The active auth and storage
// owner must agree before transport begins, and failures remain visible in the
// shared sync status.
export function syncToCloud(fn) {
  const user = useAuth.getState().user;
  if (!user || getStorageOwner() !== user.uid) return Promise.resolve(false);

  return Promise.resolve()
    .then(() => fn(user.uid))
    .then(() => true)
    .catch((error) => {
      console.error("Cloud sync failed:", error);

      if (useAuth.getState().user?.uid === user.uid) {
        useSync.getState().setSyncStatus("bootstrap", "error", user.uid);
      }

      return false;
    });
}

// Auth-gated cloud read that revalidates account ownership before applying a
// response. Domain stores remain responsible for normalization and merging.
export async function loadFromCloud(fn, onSuccess, { applyNull = false } = {}) {
  const user = useAuth.getState().user;
  if (!user || getStorageOwner() !== user.uid) return null;

  try {
    const data = await fn(user.uid);

    if (
      useAuth.getState().user?.uid !== user.uid ||
      getStorageOwner() !== user.uid
    ) return null;

    if (applyNull || (data !== null && data !== undefined)) {
      await onSuccess(data, user.uid);
    }

    return data;
  } catch (error) {
    console.error("Cloud sync failed:", error);
    throw error;
  }
}
