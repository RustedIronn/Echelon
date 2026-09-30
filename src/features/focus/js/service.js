import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  setDoc,
} from "firebase/firestore";

import { db } from "@core/firebase";

export async function saveFocusSession(uid, session) {
  if (!session?.id) throw new Error("Focus session is missing an id.");

  await setDoc(doc(db, "users", uid, "focusSessions", session.id), session);
}

export async function loadFocusSessions(uid) {
  const q = query(
    collection(db, "users", uid, "focusSessions"),
    orderBy("date", "desc"),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
  }));
}
