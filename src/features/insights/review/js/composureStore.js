import { create } from "zustand";

import {
  getStorageOwner,
  subscribeStorageOwner,
} from "../../../../shared/storage.js";
import { upsertComposureReview } from "./composure.js";
import {
  loadComposureDocument,
  saveComposureDocument,
} from "./composureStorage.js";

const getOwnedData = (get) => {
  const owner = getStorageOwner();
  const state = get();
  return owner && state.owner === owner ? state.data : null;
};

export const useComposure = create((set, get) => ({
  owner: getStorageOwner(),
  data: loadComposureDocument(),

  saveToday: (input, now = new Date()) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const reviews = upsertComposureReview(current.reviews, input, now);
    if (reviews === current.reviews) return false;

    const data = saveComposureDocument({ ...current, reviews });
    if (!data) return false;
    set({ data });
    return true;
  },
}));

subscribeStorageOwner(() => {
  useComposure.setState({
    owner: getStorageOwner(),
    data: loadComposureDocument(),
  });
});
