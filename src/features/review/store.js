import { useEffect } from "react";
import { create } from "zustand";

import { useAuth } from "@core/auth/store";
import { useSync } from "@/ui/useSync";
import {
  getStorageOwner,
  subscribeStorageOwner,
} from "../../shared/storage.js";
import { getReviews, saveReviews } from "./reviewStorage.js";
import { loadReviewsCloud, saveReviewCloud } from "./service.js";
import { createReviewSyncController } from "./sync.js";

const useReviewStore = create(() => ({
  owner: getStorageOwner(),
  history: getReviews(),
  syncStatus: "idle",
  syncError: null,
}));

const context = () => ({
  authUid: useAuth.getState().user?.uid ?? null,
  storageOwner: getStorageOwner(),
  storeOwner: useReviewStore.getState().owner,
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
    isOwned(uid) ? useReviewStore.getState().history : [],
  applyHistory: (uid, history) => {
    if (!isOwned(uid)) return false;
    const saved = saveReviews(history);
    if (!saved || !isOwned(uid)) return false;
    useReviewStore.setState({ history: saved });
    return true;
  },
  setStatus: (uid, syncStatus, error = null) => {
    if (!isOwned(uid)) return false;
    useReviewStore.setState({
      syncStatus,
      syncError: error instanceof Error ? error.message : null,
    });

    const sync = useSync.getState();
    if (syncStatus === "syncing") sync.setSyncing();
    if (syncStatus === "synced") sync.setSynced();
    if (syncStatus === "error") sync.setSyncError();
    return true;
  },
  loadCloudHistory: loadReviewsCloud,
  saveCloudReview: saveReviewCloud,
});

subscribeStorageOwner((owner) => {
  const previousOwner = useReviewStore.getState().owner;
  if (previousOwner) controller.deactivate(previousOwner);
  useReviewStore.setState({
    owner,
    history: getReviews(),
    syncStatus: "idle",
    syncError: null,
  });
});

export default function useReview(review) {
  const state = useReviewStore();
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

export { controller as reviewSyncController, useReviewStore };
