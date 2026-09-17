import {
  doc,
  getDocs,
  collection,
  orderBy,
  query,
  runTransaction,
} from "firebase/firestore";

import { db } from "@core/firebase";
import {
  normalizeReview,
  resolveReviewConflict,
  reviewsHaveEqualContent,
} from "./reviews.js";

export async function saveReviewCloud(uid, review) {
  const local = normalizeReview(review);
  if (!local) throw new Error("Cannot save an invalid Daily Review.");

  return runTransaction(db, async (transaction) => {
    const reference = doc(db, "users", uid, "reviews", local.date);
    const snapshot = await transaction.get(reference);
    const remote = snapshot.exists() ? normalizeReview(snapshot.data()) : null;
    const winner = resolveReviewConflict(local, remote);

    if (
      remote &&
      winner &&
      (reviewsHaveEqualContent(remote, local) ||
        !reviewsHaveEqualContent(winner, local))
    ) {
      return { written: false, review: winner };
    }

    transaction.set(reference, local);
    return { written: true, review: local };
  });
}

export async function loadReviewsCloud(uid) {
  const q = query(
    collection(db, "users", uid, "reviews"),
    orderBy("date", "desc"),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((reviewDocument) => reviewDocument.data());
}
