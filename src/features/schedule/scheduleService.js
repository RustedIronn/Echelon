import { saveUserData, getUserData } from "@core/firestore";
import { normalizeScheduleItems } from "./constants";

export async function saveSchedule(uid, document) {
  await saveUserData(uid, "settings", "schedule", document);
}

export async function loadSchedule(uid) {
  const data = await getUserData(uid, "settings", "schedule");
  const schedule = normalizeScheduleItems(data?.schedule);

  return schedule
    ? {
        ...data,
        schedule,
        revision: Number.isInteger(data.revision) ? data.revision : 0,
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
      }
    : null;
}
