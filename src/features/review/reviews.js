const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const BREAKDOWN_LABELS = ["Tasks", "Habits", "Focus", "Workout"];

export function isValidReviewDay(value) {
  const match = typeof value === "string" && value.match(DAY_KEY_PATTERN);
  if (!match) return false;

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

const normalizeTimestamp = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;

const normalizeTextList = (value) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim())
    : undefined;

export function normalizeReviewBreakdown(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length !== BREAKDOWN_LABELS.length) {
    return null;
  }

  const byLabel = new Map();
  for (const item of value) {
    if (
      !item ||
      !BREAKDOWN_LABELS.includes(item.label) ||
      byLabel.has(item.label) ||
      !Number.isFinite(item.value) ||
      item.value < 0 ||
      item.value > 100
    ) {
      return null;
    }
    byLabel.set(item.label, { label: item.label, value: item.value });
  }

  return BREAKDOWN_LABELS.map((label) => byLabel.get(label));
}

export function normalizeReview(value) {
  if (
    !value ||
    !isValidReviewDay(value.date) ||
    !Number.isFinite(value.score) ||
    value.score < 0 ||
    value.score > 100
  ) {
    return null;
  }

  const breakdown = normalizeReviewBreakdown(value.breakdown);
  if (breakdown === null) return null;

  const review = { date: value.date, score: value.score };
  const wins = normalizeTextList(value.wins);
  const improvements = normalizeTextList(value.improvements);
  if (wins) review.wins = wins;
  if (improvements) review.improvements = improvements;

  if (Number.isFinite(value.focusMinutes) && value.focusMinutes >= 0) {
    review.focusMinutes = value.focusMinutes;
  }
  if (typeof value.workoutCompleted === "boolean") {
    review.workoutCompleted = value.workoutCompleted;
  }
  if (typeof value.workoutRequired === "boolean") {
    review.workoutRequired = value.workoutRequired;
  }
  if (breakdown !== undefined) review.breakdown = breakdown;

  const updatedAt = normalizeTimestamp(value.updatedAt);
  if (updatedAt) review.updatedAt = updatedAt;

  return review;
}

const reviewContent = (review) => {
  const content = { ...review };
  delete content.updatedAt;
  return content;
};

export function reviewsHaveEqualContent(left, right) {
  const normalizedLeft = normalizeReview(left);
  const normalizedRight = normalizeReview(right);
  return Boolean(
    normalizedLeft &&
    normalizedRight &&
    JSON.stringify(reviewContent(normalizedLeft)) ===
      JSON.stringify(reviewContent(normalizedRight)),
  );
}

const newerReview = (current, candidate) => {
  if (!current) return candidate;
  const currentTime = current.updatedAt
    ? Date.parse(current.updatedAt)
    : Number.NEGATIVE_INFINITY;
  const candidateTime = candidate.updatedAt
    ? Date.parse(candidate.updatedAt)
    : Number.NEGATIVE_INFINITY;
  return candidateTime > currentTime ? candidate : current;
};

export function normalizeReviews(values) {
  if (!Array.isArray(values)) return [];

  const byDate = new Map();
  for (const value of values) {
    const review = normalizeReview(value);
    if (!review) continue;
    byDate.set(review.date, newerReview(byDate.get(review.date), review));
  }

  return [...byDate.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

export function resolveReviewConflict(localValue, cloudValue) {
  const local = normalizeReview(localValue);
  const cloud = normalizeReview(cloudValue);
  if (!local) return cloud;
  if (!cloud) return local;
  if (reviewsHaveEqualContent(local, cloud)) return local;

  const localTime = local.updatedAt ? Date.parse(local.updatedAt) : null;
  const cloudTime = cloud.updatedAt ? Date.parse(cloud.updatedAt) : null;
  if (localTime !== null && cloudTime !== null && localTime !== cloudTime) {
    return cloudTime > localTime ? cloud : local;
  }

  return local;
}

export function reconcileReviewHistories(localValues, cloudValues) {
  const local = normalizeReviews(localValues);
  const cloud = normalizeReviews(cloudValues);
  const localByDate = new Map(local.map((review) => [review.date, review]));
  const cloudByDate = new Map(cloud.map((review) => [review.date, review]));
  const dates = new Set([...localByDate.keys(), ...cloudByDate.keys()]);
  const history = [];
  const uploads = [];

  for (const date of dates) {
    const localReview = localByDate.get(date);
    const cloudReview = cloudByDate.get(date);
    const winner = resolveReviewConflict(localReview, cloudReview);
    if (!winner) continue;
    history.push(winner);

    if (
      localReview &&
      cloudReview &&
      reviewsHaveEqualContent(winner, localReview) &&
      !reviewsHaveEqualContent(localReview, cloudReview)
    ) {
      uploads.push(localReview);
    }
  }

  history.sort((left, right) => left.date.localeCompare(right.date));
  uploads.sort((left, right) => left.date.localeCompare(right.date));
  return { history, uploads };
}

export function upsertReview(values, input, now = new Date()) {
  const history = normalizeReviews(values);
  const candidate = normalizeReview(input);
  if (!candidate) return { history, review: null, changed: false };

  const existing = history.find((review) => review.date === candidate.date);
  if (existing && reviewsHaveEqualContent(existing, candidate)) {
    return { history, review: existing, changed: false };
  }

  const requestedTime = Date.parse(now.toISOString());
  const existingTime = existing?.updatedAt
    ? Date.parse(existing.updatedAt)
    : Number.NEGATIVE_INFINITY;
  const updatedAt = normalizeTimestamp(
    new Date(Math.max(requestedTime, existingTime + 1)).toISOString(),
  );
  if (!updatedAt) return { history, review: null, changed: false };
  const review = { ...candidate, updatedAt };
  const next = history.filter((item) => item.date !== review.date);
  next.push(review);
  next.sort((left, right) => left.date.localeCompare(right.date));
  return { history: next, review, changed: true };
}
