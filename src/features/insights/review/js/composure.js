import {
  COMPOSURE_CHECKLIST,
  COMPOSURE_NOTE_MAX_LENGTH,
} from "./composureConstants.js";
import { getLocalWeekRange, isValidDayKey } from "../../../../shared/date.js";

const checklistIds = new Set(COMPOSURE_CHECKLIST.map((item) => item.id));

const roundOne = (value) => Math.round(value * 10) / 10;

const normalizeTimestamp = (value) => {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
};

export function createEmptyComposureChecks() {
  return Object.fromEntries(COMPOSURE_CHECKLIST.map(({ id }) => [id, false]));
}

export function normalizeComposureChecks(value) {
  const checks = createEmptyComposureChecks();
  if (!value || typeof value !== "object" || Array.isArray(value)) return checks;

  Object.entries(value).forEach(([id, checked]) => {
    if (checklistIds.has(id) && typeof checked === "boolean") {
      checks[id] = checked;
    }
  });
  return checks;
}

export function normalizeComposureRating(value) {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
    ? value
    : null;
}

export function normalizeComposureNote(value) {
  return typeof value === "string"
    ? value.trim().slice(0, COMPOSURE_NOTE_MAX_LENGTH)
    : "";
}

export function normalizeComposureRecord(value) {
  if (!isValidDayKey(value?.date)) return null;
  const id = `composure:${value.date}`;
  if (value.id !== id) return null;

  const createdAt = normalizeTimestamp(value.createdAt);
  const updatedAt = normalizeTimestamp(value.updatedAt);
  if (!createdAt || !updatedAt) return null;

  return {
    id,
    date: value.date,
    checks: normalizeComposureChecks(value.checks),
    composureRating: normalizeComposureRating(value.composureRating),
    tomorrowNote: normalizeComposureNote(value.tomorrowNote),
    createdAt,
    updatedAt,
  };
}

export function sortComposureHistory(reviews) {
  return [...reviews].sort((left, right) => {
    const byDate = right.date.localeCompare(left.date);
    return byDate || right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function normalizeComposureReviews(value) {
  if (!Array.isArray(value)) return [];
  const byDate = new Map();

  value.forEach((entry) => {
    const review = normalizeComposureRecord(entry);
    if (!review) return;
    const current = byDate.get(review.date);
    if (!current || review.updatedAt >= current.updatedAt) {
      byDate.set(review.date, review);
    }
  });

  return sortComposureHistory([...byDate.values()]);
}

const nextTimestamp = (current, now) => {
  const candidate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(candidate.getTime())) return null;
  const currentTime = Date.parse(current?.updatedAt);
  if (Number.isNaN(currentTime) || candidate.getTime() > currentTime) {
    return candidate.toISOString();
  }
  const next = new Date(currentTime + 1);
  return Number.isNaN(next.getTime()) ? null : next.toISOString();
};

export function upsertComposureReview(reviews, input, now = new Date()) {
  if (!isValidDayKey(input?.date)) return reviews;
  const normalized = normalizeComposureReviews(reviews);
  const current = normalized.find((review) => review.date === input.date);
  const updatedAt = nextTimestamp(current, now);
  if (!updatedAt) return reviews;

  const review = normalizeComposureRecord({
    id: `composure:${input.date}`,
    date: input.date,
    checks: input.checks,
    composureRating: input.composureRating,
    tomorrowNote: input.tomorrowNote,
    createdAt: current?.createdAt ?? updatedAt,
    updatedAt,
  });
  if (!review) return reviews;

  return sortComposureHistory([
    ...normalized.filter((item) => item.date !== review.date),
    review,
  ]);
}

export function countComposureChecks(review) {
  const checks = normalizeComposureChecks(review?.checks);
  return COMPOSURE_CHECKLIST.reduce(
    (total, item) => total + (checks[item.id] ? 1 : 0),
    0,
  );
}

export function filterComposureWeek(reviews, reference = new Date()) {
  const range = getLocalWeekRange(reference);
  if (!range) return [];

  return normalizeComposureReviews(reviews).filter(
    (review) => review.date >= range.start && review.date <= range.end,
  );
}

export function averageComposureRating(reviews) {
  const ratings = normalizeComposureReviews(reviews)
    .map((review) => review.composureRating)
    .filter((rating) => rating !== null);
  if (!ratings.length) return null;
  return roundOne(ratings.reduce((total, rating) => total + rating, 0) / ratings.length);
}

export function averageChecklistCompletion(reviews) {
  const normalized = normalizeComposureReviews(reviews);
  if (!normalized.length) return null;
  const totalPossible = normalized.length * COMPOSURE_CHECKLIST.length;
  const totalChecked = normalized.reduce(
    (total, review) => total + countComposureChecks(review),
    0,
  );
  return roundOne((totalChecked / totalPossible) * 100);
}

export function getComposureWeeklyMetrics(reviews, reference = new Date()) {
  const weekly = filterComposureWeek(reviews, reference);
  return {
    reviewsCompleted: weekly.length,
    averageRating: averageComposureRating(weekly),
    averageChecklistCompletion: averageChecklistCompletion(weekly),
  };
}
