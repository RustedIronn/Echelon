import { saveUserData, getUserData } from "@services/firestore";

export async function saveHabits(uid, date, data) {
  await saveUserData(uid, "habits", date, { date, data });
}

export async function loadHabits(uid, date) {
  return getUserData(uid, "habits", date);
}
