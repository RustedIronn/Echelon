import { saveData, loadData } from "@utils/storage";

const KEY = "echelon_reviews";

export function saveReview(review) {
  const reviews = loadData(KEY, []);

  const exists = reviews.some((item) => item.date === review.date);

  const updated = exists
    ? reviews.map((item) => (item.date === review.date ? review : item))
    : [...reviews, review];

  saveData(KEY, updated);

  return updated;
}

export function getReviews() {
  return loadData(KEY, []);
}
