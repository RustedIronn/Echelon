import { useEffect } from "react";
import { create } from "zustand";

import { useAuth } from "@core/auth/store";
import { useSync } from "@/ui/useSync";
import {
  getStorageOwner,
  subscribeStorageOwner,
} from "../../../shared/storage.js";
import {
  loadReviewHistory,
  saveReviewHistory,
} from "./reviewStorage.js";
import { loadReviewHistoryCloud, saveReviewCloud } from "./service.js";
import { createReviewSyncController } from "./sync.js";

const useDailyReviewStore = create(() => ({
  owner: getStorageOwner(),
  history: loadReviewHistory(),
  syncStatus: "idle",
  syncError: null,
}));

const context = () => ({
  authUid: useAuth.getState().user?.uid ?? null,
  storageOwner: getStorageOwner(),
  storeOwner: useDailyReviewStore.getState().owner,
});

const isOwned = (uid) => {
  const current = context();
  return (
    current.authUid === uid &&
    current.storageOwner === uid &&
    current.storeOwner === uid
  );
};

const controller = createReviewSyncController({
  getContext: context,
  getLocalHistory: (uid) =>
    isOwned(uid) ? useDailyReviewStore.getState().history : [],
  applyHistory: (uid, history) => {
    if (!isOwned(uid)) return false;
    const saved = saveReviewHistory(history);
    if (!saved || !isOwned(uid)) return false;
    useDailyReviewStore.setState({ history: saved });
    return true;
  },
  setStatus: (uid, syncStatus, error = null) => {
    if (!isOwned(uid)) return false;
    useDailyReviewStore.setState({
      syncStatus,
      syncError: error instanceof Error ? error.message : null,
    });

    useSync.getState().setSyncStatus("review", syncStatus, uid);
    return true;
  },
  loadCloudHistory: loadReviewHistoryCloud,
  saveCloudReview: saveReviewCloud,
});

subscribeStorageOwner((owner) => {
  const previousOwner = useDailyReviewStore.getState().owner;
  if (previousOwner) controller.deactivate(previousOwner);
  useDailyReviewStore.setState({
    owner,
    history: loadReviewHistory(),
    syncStatus: "idle",
    syncError: null,
  });
});

export default function useDailyReviews(review) {
  const state = useDailyReviewStore();
  const authUid = useAuth((authState) => authState.user?.uid ?? null);
  const reviewSignature = review ? JSON.stringify(review) : "";

  useEffect(() => {
    if (!authUid || !isOwned(authUid)) return;
    void controller.activate(authUid);
  }, [authUid]);

  useEffect(() => {
    if (!authUid || !reviewSignature || !isOwned(authUid)) return;
    void controller.save(authUid, JSON.parse(reviewSignature));
  }, [authUid, reviewSignature]);

  return state;
}
