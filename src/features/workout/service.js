import { saveUserData, getUserData } from "@core/firestore";

export async function saveWorkoutCloud(uid, sessions) {
  await saveUserData(uid, "workout", "history", { sessions });
}

export async function loadWorkoutCloud(uid) {
  const data = await getUserData(uid, "workout", "history");
  return data?.sessions || [];
}
