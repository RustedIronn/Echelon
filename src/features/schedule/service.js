import { saveUserData, getUserData } from "@services/firestore";

export async function saveSchedule(uid, schedule) {
  await saveUserData(uid, "settings", "schedule", { schedule });
}

export async function loadSchedule(uid) {
  const data = await getUserData(uid, "settings", "schedule");
  return data?.schedule || null;
}
