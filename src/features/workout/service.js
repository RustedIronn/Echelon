import { saveUserData, getUserData } from "@core/firestore";

export function saveWorkoutHistoryCloud(uid, sessions) {
  return saveUserData(uid, "workout", "history", { sessions });
}

export async function loadWorkoutHistoryCloud(uid) {
  const document = await getUserData(uid, "workout", "history");
  return document?.sessions ?? [];
}
