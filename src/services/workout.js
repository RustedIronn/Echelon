import { doc, getDoc, setDoc } from "firebase/firestore";

import { db } from "@config/firebase";

export async function saveWorkoutCloud(userId, sessions) {
  const ref = doc(db, "users", userId, "workout", "history");

  await setDoc(ref, {
    sessions,
  });
}

export async function loadWorkoutCloud(userId) {
  const ref = doc(db, "users", userId, "workout", "history");

  const snap = await getDoc(ref);

  if (!snap.exists()) return [];

  return snap.data().sessions || [];
}
