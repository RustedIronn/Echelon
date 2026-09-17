import { saveData, loadData } from "../../shared/storage.js";
import {
  normalizeReviews,
  reconcileReviewHistories,
  upsertReview,
} from "./reviews.js";

const KEY = "echelon_reviews";

export function mergeReviews(cloudReviews, localReviews) {
  return reconcileReviewHistories(localReviews, cloudReviews).history;
}

export function saveReviews(reviews) {
  const safeReviews = normalizeReviews(reviews);
  return saveData(KEY, safeReviews) ? safeReviews : null;
}

export function saveReview(review, now = new Date()) {
  const result = upsertReview(getReviews(), review, now);
  if (!result.changed) return result.review ? result.history : null;
  return saveReviews(result.history);
}

export function getReviews() {
  return normalizeReviews(loadData(KEY, []));
}
