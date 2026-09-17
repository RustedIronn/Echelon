import { useAuth } from "./auth/store";
import { useSync } from "../ui/useSync";
import { getStorageOwner } from "../shared/storage";

// Fire-and-forget cloud write, gated on auth. Replaces the
// "const user = useAuth.getState().user; if (user) { ...().catch(console.error) }"
// block that was copy-pasted across useHabits, useToday (twice), useFocus, and useWorkout.
export function syncToCloud(fn) {
  const user = useAuth.getState().user;
  if (!user || getStorageOwner() !== user.uid) return Promise.resolve(false);

  return Promise.resolve()
    .then(() => fn(user.uid))
    .then(() => true)
    .catch((error) => {
      console.error("Cloud sync failed:", error);

      if (useAuth.getState().user?.uid === user.uid) {
        useSync.getState().setSyncError();
      }

      return false;
    });
}

// Shared shape for every store's loadFromCloud: guard on auth, try/catch,
// only apply the result if the load actually returned something.
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
