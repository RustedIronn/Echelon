import { saveUserData, getUserData } from "@core/firestore";

export async function saveDaily(uid, date, data) {
  await saveUserData(uid, "daily", date, data);
}

export async function loadDaily(uid, date) {
  return getUserData(uid, "daily", date);
}
