import { saveData, loadData } from "../../shared/storage.js";
import { normalizeReviews } from "./reviews.js";

const REVIEW_STORAGE_KEY = "echelon_reviews";

export function saveReviewHistory(reviews) {
  const safeReviews = normalizeReviews(reviews);
  return saveData(REVIEW_STORAGE_KEY, safeReviews) ? safeReviews : null;
}

export function loadReviewHistory() {
  return normalizeReviews(loadData(REVIEW_STORAGE_KEY, []));
}
