import { useAuth } from "@features/auth/store";

// Fire-and-forget cloud write, gated on auth. Replaces the
// "const user = useAuth.getState().user; if (user) { ...().catch(console.error) }"
// block that was copy-pasted across useHabits, useToday (twice), useFocus, and useWorkout.
export function syncToCloud(fn) {
  const user = useAuth.getState().user;
  if (!user) return;

  fn(user.uid).catch((error) => {
    console.error("Cloud sync failed:", error);
  });
}

// Shared shape for every store's loadFromCloud: guard on auth, try/catch,
// only apply the result if the load actually returned something.
export async function loadFromCloud(fn, onSuccess) {
  const user = useAuth.getState().user;
  if (!user) return;

  try {
    const data = await fn(user.uid);
    if (data !== null && data !== undefined) {
      onSuccess(data);
    }
  } catch (error) {
    console.error("Cloud sync failed:", error);
  }
}
