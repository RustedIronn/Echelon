import { doc, getDoc, runTransaction } from "firebase/firestore";

import { db } from "../../core/firebase.js";
import { resolveVersionedState } from "../../shared/versionedState.js";
import {
  normalizeMoneyCloudDocument,
  normalizeMoneyDocument,
  selectMoneySource,
} from "./storage.js";

const moneyDocumentRef = (uid) => doc(db, "users", uid, "money", "state");

export async function loadMoneyFromCloud(uid) {
  const snapshot = await getDoc(moneyDocumentRef(uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveMoneyToCloud(uid, value) {
  const document = normalizeMoneyDocument(value);

  return runTransaction(db, async (transaction) => {
    const reference = moneyDocumentRef(uid);
    const snapshot = await transaction.get(reference);
    const existing = snapshot.exists()
      ? normalizeMoneyCloudDocument(snapshot.data())
      : null;
    const resolution = resolveVersionedState(
      document,
      existing,
      selectMoneySource,
    );

    if (resolution.source !== "local") {
      return { written: false, document: resolution.value };
    }

    // Replace the document so only the explicit Money source schema is stored.
    transaction.set(reference, document);
    return { written: true, document };
  });
}
