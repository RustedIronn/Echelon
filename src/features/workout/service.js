import { saveUserData, getUserData } from "@core/firestore";
import { normalizeWorkoutHistory } from "./workoutStorage";

export async function saveWorkoutCloud(uid, sessions) {
  await saveUserData(uid, "workout", "history", { sessions });
}

export async function loadWorkoutCloud(uid) {
  const data = await getUserData(uid, "workout", "history");
  return normalizeWorkoutHistory(data?.sessions);
}
