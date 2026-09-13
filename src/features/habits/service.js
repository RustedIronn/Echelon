import { saveUserData, getUserData } from "@core/firestore";

export async function saveHabits(uid, document) {
  await saveUserData(uid, "habits", document.date, document);
}

export async function loadHabits(uid, date) {
  const data = await getUserData(uid, "habits", date);

  return Array.isArray(data?.data) &&
    data.data.length > 0 &&
    data.data.every((habit) => habit && typeof habit.name === "string")
    ? {
        ...data,
        revision: Number.isInteger(data.revision) ? data.revision : 0,
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
      }
    : null;
}
