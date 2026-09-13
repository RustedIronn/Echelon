import {
  doc,
  setDoc,
  getDocs,
  collection,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "@core/firebase";

export async function saveReviewCloud(uid, review) {
  await setDoc(doc(db, "users", uid, "reviews", review.date), review, {
    merge: true,
  });
}

export async function loadReviewsCloud(uid) {
  const q = query(
    collection(db, "users", uid, "reviews"),
    orderBy("date", "desc"),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }))
    .filter((review) => typeof review.date === "string");
}
