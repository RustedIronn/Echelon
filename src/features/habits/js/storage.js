import { loadData, saveData } from "../../../shared/storage.js";
import { normalizeHabitDocument } from "./habits.js";

const HABITS_STORAGE_KEY = "echelon_habits";

export function loadHabitDocument(date) {
  return normalizeHabitDocument(
    loadData(HABITS_STORAGE_KEY, null),
    date,
  );
}

export function saveHabitDocument(document) {
  const normalized = normalizeHabitDocument(document, document?.date);
  if (!normalized) return null;
  return saveData(HABITS_STORAGE_KEY, normalized) ? normalized : null;
}
