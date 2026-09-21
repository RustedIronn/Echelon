import { getLocalWeekRange, getToday, parseDayKey } from "@/shared/date";
import { normalizeReviews } from "@features/review/reviews";
import { normalizeFocusSessions } from "@features/focus/utils";
import { mergeWorkoutHistories } from "@features/workout/workoutStorage";

const average = (values) => values.length
  ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  : null;

export function createAnalysisPeriods(range, now = new Date()) {
  const today = getToday(now);
  const weekly = range === "12w";
  const count = range === "30d" ? 30 : weekly ? 12 : 7;
  const last = weekly ? parseDayKey(getLocalWeekRange(now).start) : parseDayKey(today);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(last);
    date.setDate(date.getDate() - (count - 1 - index) * (weekly ? 7 : 1));
    const start = getToday(date);
    const endDate = new Date(date);
    if (weekly) endDate.setDate(endDate.getDate() + 6);
    const end = getToday(endDate);
    const label = weekly
      ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)
      : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
    return { start, end, label, dateLabel: weekly ? `${start} – ${end}` : start };
  });
}

export function deriveAnalysisSeries({ reviews, focusSessions, workoutSessions }, range = "7d", now = new Date()) {
  const validReviews = normalizeReviews(reviews);
  const validFocus = normalizeFocusSessions(focusSessions);
  const validWorkouts = mergeWorkoutHistories(workoutSessions, []);
  return createAnalysisPeriods(range, now).map((period) => {
    const inPeriod = (date) => date >= period.start && date <= period.end;
    const reviewDays = validReviews.filter((review) => inPeriod(review.date));
    const focusDays = validFocus.filter((session) => inPeriod(session.dayKey));
    const workoutDays = validWorkouts.filter((session) => inPeriod(session.date));
    const habitScores = reviewDays.flatMap((review) => {
      const value = review.breakdown?.find((item) => item.label === "Habits")?.value;
      return Number.isFinite(value) ? [value] : [];
    });
    return {
      ...period,
      execution: average(reviewDays.map((review) => review.score)),
      focus: focusDays.length ? Math.round(focusDays.reduce((sum, session) => sum + session.duration, 0) / 60) : null,
      habits: average(habitScores),
      workouts: workoutDays.length || null,
      trainingMinutes: workoutDays.length ? Math.round(workoutDays.reduce((sum, session) => sum + session.duration, 0) / 60) : null,
    };
  });
}
