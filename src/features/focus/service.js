import {
  addDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "@core/firebase";

export async function saveFocusSession(uid, session) {
  await addDoc(collection(db, "users", uid, "focusSessions"), session);
}

export async function loadFocusSessions(uid) {
  const q = query(
    collection(db, "users", uid, "focusSessions"),
    orderBy("date", "desc"),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}
