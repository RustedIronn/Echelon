import { getUserData, saveUserData } from "@core/firestore";

export function saveScheduleCloud(uid, document) {
  return saveUserData(uid, "settings", "schedule", document);
}

export function loadScheduleCloud(uid) {
  return getUserData(uid, "settings", "schedule");
}

export function saveTodayCloud(uid, date, document) {
  return saveUserData(uid, "daily", date, document);
}

export function loadTodayCloud(uid, date) {
  return getUserData(uid, "daily", date);
}
