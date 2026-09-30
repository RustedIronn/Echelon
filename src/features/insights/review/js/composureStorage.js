import { loadData, saveData } from "../../../../shared/storage.js";
import {
  COMPOSURE_STORAGE_KEY,
  COMPOSURE_VERSION,
} from "./composureConstants.js";
import { normalizeComposureReviews } from "./composure.js";

export function createEmptyComposureDocument() {
  return { version: COMPOSURE_VERSION, reviews: [] };
}

export function normalizeComposureDocument(value) {
  if (!value || value.version !== COMPOSURE_VERSION) {
    return createEmptyComposureDocument();
  }
  return {
    version: COMPOSURE_VERSION,
    reviews: normalizeComposureReviews(value.reviews),
  };
}

export function loadComposureDocument() {
  return normalizeComposureDocument(
    loadData(COMPOSURE_STORAGE_KEY, null),
  );
}

export function saveComposureDocument(value) {
  const document = normalizeComposureDocument(value);
  return saveData(COMPOSURE_STORAGE_KEY, document) ? document : null;
}
