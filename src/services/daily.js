import { saveUserData, getUserData } from "@services/firestore";

export async function saveDaily(uid, date, data) {
  await saveUserData(uid, "daily", date, data);
}

export async function loadDaily(uid, date) {
  return getUserData(uid, "daily", date);
}
