import { saveUserData, getUserData } from "@core/firestore";

export async function saveHabits(uid, document) {
  await saveUserData(uid, "habits", document.date, document);
}

export async function loadHabits(uid, date) {
  return getUserData(uid, "habits", date);
}
