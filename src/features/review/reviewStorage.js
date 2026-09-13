import { saveData, loadData } from "../../shared/storage.js";

const KEY = "echelon_reviews";

const validReviews = (reviews) =>
  Array.isArray(reviews)
    ? reviews.filter((review) =>
        review && typeof review.date === "string",
      )
    : [];

export function mergeReviews(cloudReviews, localReviews) {
  const byDate = new Map();

  for (const review of [
    ...validReviews(cloudReviews),
    ...validReviews(localReviews),
  ]) {
    byDate.set(review.date, review);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function saveReviews(reviews) {
  const safeReviews = validReviews(reviews);

  saveData(KEY, safeReviews);
  return safeReviews;
}

export function saveReview(review) {
  const stored = loadData(KEY, []);
  const reviews = Array.isArray(stored) ? stored : [];

  const exists = reviews.some((item) => item.date === review.date);

  const updated = exists
    ? reviews.map((item) => (item.date === review.date ? review : item))
    : [...reviews, review];

  return saveReviews(updated);
}

export function getReviews() {
  const reviews = loadData(KEY, []);

  return validReviews(reviews);
}
