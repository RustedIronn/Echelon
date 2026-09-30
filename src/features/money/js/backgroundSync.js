import { useAuth } from "../../../core/auth/authStore.js";
import { useSync } from "../../../ui/useSync.js";
import { loadMoneyFromCloud, saveMoneyToCloud } from "./service.js";
import {
  applyMoneyCloudDocument,
  getOwnedMoneyDocument,
  setMoneySyncStatus,
  useMoney,
} from "./store.js";
import {
  normalizeMoneyCloudDocument,
  selectMoneySource,
} from "./storage.js";
import {
  bindMoneyRecoveryEvents,
  createMoneySyncController,
} from "./syncController.js";
import { registerMoneyMutationHandler } from "./syncRuntime.js";

const controller = createMoneySyncController({
  getContext: () => ({
    authUid: useAuth.getState().user?.uid ?? null,
    storeOwner: useMoney.getState().owner,
  }),
  getLocalDocument: getOwnedMoneyDocument,
  applyCloudDocument: applyMoneyCloudDocument,
  setStatus: (uid, status, error) => {
    setMoneySyncStatus(uid, status, error);
    useSync.getState().setSyncStatus(
      "money",
      status === "pending" ? "syncing" : status,
      uid,
    );
  },
  loadCloudDocument: loadMoneyFromCloud,
  saveCloudDocument: saveMoneyToCloud,
  normalizeCloudDocument: normalizeMoneyCloudDocument,
  selectContent: selectMoneySource,
});

registerMoneyMutationHandler((uid, document) => {
  controller.enqueue(uid, document);
});

export function startMoneyBackgroundSync(uid) {
  return controller.activate(uid);
}

export function recoverMoneyBackgroundSync(uid) {
  return controller.recover(uid);
}

export function stopMoneyBackgroundSync(uid) {
  controller.deactivate(uid);
}

export function bindMoneyBackgroundRecovery(uid) {
  return bindMoneyRecoveryEvents(uid, recoverMoneyBackgroundSync);
}
