import { saveUserData, getUserData } from "@core/firestore";
import { normalizeDailyTasks } from "./constants";

export async function saveDaily(uid, date, data) {
  await saveUserData(uid, "daily", date, data);
}

export async function loadDaily(uid, date) {
  const data = await getUserData(uid, "daily", date);

  const tasks = normalizeDailyTasks(data?.tasks);

  return tasks
    ? {
        ...data,
        tasks,
        revision: Number.isInteger(data.revision) ? data.revision : 0,
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
      }
    : null;
}
