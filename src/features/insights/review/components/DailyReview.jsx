import { Link, useSearchParams } from "react-router-dom";
import { BarChart3, ChevronRight } from "lucide-react";
import { formatDayKey, getToday, isValidDayKey } from "@/shared/date";
import { useToday } from "@/features/plan/schedule/js/todayStore";
import { useHabits } from "@features/habits/js/store.js";
import { useFocus } from "@features/focus/js/store.js";
import { getTodayWorkout } from "@features/workouts/js/utils.js";
import { getWorkoutStats } from "@features/workouts/js/analyzer.js";
import { useWorkout } from "@features/workouts/js/store.js";
import { generateReview } from "@features/insights/review/js/analyzer";
import useDailyReviews from "@features/insights/review/js/store";

import { computeReviewBreakdown } from "../js/breakdown";
import { useComposure } from "../js/composureStore";
import { countComposureChecks } from "../js/composure";
import { COMPOSURE_CHECKLIST } from "../js/composureConstants";
import { ActionLink } from "@ui";

export default function DailyReview() {
  const [searchParams] = useSearchParams();
  const { tasks } = useToday();
  const { habits } = useHabits();
  const { sessions } = useFocus();
  const workouts = useWorkout((state) => state.sessions);
  const workoutStats = getWorkoutStats(workouts);
  const scheduledWorkout = getTodayWorkout();
  const review = generateReview({
    tasks,
    habits,
    sessions,
    workoutStats,
    scheduledWorkout,
  });
  const breakdown = computeReviewBreakdown({
    tasks,
    habits,
    sessions,
    workoutCompleted: review.workoutCompleted,
  });
  const { history } = useDailyReviews({ ...review, breakdown });
  const selectedDate = searchParams.get("date");
  const selectedReview = selectedDate && isValidDayKey(selectedDate) && selectedDate !== getToday()
    ? history.find((item) => item.date === selectedDate)
    : null;
  const displayed = selectedReview ?? { ...review, breakdown };
  const composureReviews = useComposure((state) => state.data.reviews);
  const composureByDate = new Map(composureReviews.map((entry) => [entry.date, entry]));
  const displayedDate = selectedReview?.date ?? getToday();
  const displayedComposure = composureByDate.get(displayedDate) ?? null;

  return (
    <div className="daily-review-workspace">
      <div className="daily-review-workspace__top"><div><h2>{selectedReview ? formatDayKey(selectedReview.date) : "Today’s review"}</h2><p>{selectedReview ? "Saved review" : "Calculated from today’s activity"}</p></div><ActionLink to="/insights/analysis"><BarChart3 size={16} aria-hidden="true" />Analysis</ActionLink></div>
      <div className="daily-review-workspace__columns">
        <section className="daily-review-main" aria-label="Daily execution review">
          <div className="daily-review-summary"><strong>{displayed.score}%</strong><span>Execution score<br /><small>Tasks · Habits · Focus · Workout</small></span></div>
          {displayed.breakdown?.length ? <section className="review-contribution"><div className="section-header"><h2>What contributed</h2></div><div className="review-breakdown">{displayed.breakdown.map((item) => <div key={item.label}><strong>{item.value}%</strong><span>{item.label}</span></div>)}</div></section> : <p>Contribution details were not stored for this older review.</p>}
          {!selectedReview && review.todayWorkout ? <p className="review-workout">Training: {review.todayWorkout.workout}</p> : null}
          <div className="daily-review-reflections">
            <section><h3>What went well</h3>{displayed.wins?.length ? <ul>{displayed.wins.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No wins recorded for this day.</p>}</section>
            <section><h3>What to adjust</h3>{displayed.improvements?.length ? <ul>{displayed.improvements.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No improvements recorded for this day.</p>}</section>
          </div>
          <div className="daily-composure-status">
            <div>
              <span>Composure</span>
              <strong>{displayedComposure ? `${countComposureChecks(displayedComposure)} of ${COMPOSURE_CHECKLIST.length} checks` : "Not reviewed"}</strong>
              <small>{displayedComposure?.composureRating ? `Rating ${displayedComposure.composureRating}/5` : "Separate behavioral review"}</small>
            </div>
            <ActionLink direction="forward" to={`/insights/composure${selectedReview ? `?date=${selectedReview.date}` : ""}`}>
              {displayedComposure ? "Open Composure" : "Review Composure"}
            </ActionLink>
          </div>
          {selectedReview ? <ActionLink direction="back" to="/insights/daily">Back to today</ActionLink> : null}
        </section>
        <aside className="daily-review-history" aria-label="Browse saved reviews">
          <h3>Previous reviews</h3>
          {history.length ? <div className="review-history">{history.slice().reverse().map((day) => <Link className="history-item" key={day.date} to={`/insights/daily?date=${day.date}`} aria-current={day.date === selectedDate ? "date" : undefined}>
            <span className="history-item__date"><i aria-hidden="true" />{formatDayKey(day.date)}</span>
            <small>{composureByDate.get(day.date)?.composureRating ? `Composure ${composureByDate.get(day.date).composureRating}/5` : "Composure not reviewed"}</small>
            <span className="history-item__score"><i aria-hidden="true"><b style={{ width: `${day.score}%` }} /></i><strong>{day.score}%</strong></span>
            <ChevronRight size={17} aria-hidden="true" />
          </Link>)}</div> : <p>No saved reviews yet.</p>}
        </aside>
      </div>
    </div>
  );
}
