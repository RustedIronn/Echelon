import { saveUserData, getUserData } from "@core/firestore";
import { isValidSchedule } from "./constants";

export async function saveSchedule(uid, document) {
  await saveUserData(uid, "settings", "schedule", document);
}

export async function loadSchedule(uid) {
  const data = await getUserData(uid, "settings", "schedule");
  return isValidSchedule(data?.schedule)
    ? {
        ...data,
        revision: Number.isInteger(data.revision) ? data.revision : 0,
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
      }
    : null;
}
