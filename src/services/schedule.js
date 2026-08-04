import { doc, setDoc, getDoc } from "firebase/firestore";

import { db } from "@config/firebase";

export async function saveSchedule(uid, schedule) {
  await setDoc(
    doc(db, "users", uid, "settings", "schedule"),
    {
      schedule,
    },
    {
      merge: true,
    },
  );
}

export async function loadSchedule(uid) {
  const snapshot = await getDoc(doc(db, "users", uid, "settings", "schedule"));

  if (snapshot.exists()) {
    return snapshot.data().schedule;
  }

  return null;
}
