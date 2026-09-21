import { Link, useSearchParams } from "react-router-dom";
import { formatDayKey, getToday, isValidDayKey } from "@/shared/date";
import { useToday } from "@/features/schedule/todayStore";
import { useHabits } from "@features/habits/store";
import { useFocus } from "@features/focus/store";
import { useWorkout } from "@features/workout/store";
import { getWorkoutStats } from "@features/workout/analyzer";
import { getTodayWorkout } from "@features/workout/utils";
import { generateReview } from "@features/review/analyzer";
import useDailyReviews from "@features/review/store";

import ReviewBreakdown from "./ReviewBreakdown";
import { computeReviewBreakdown } from "../breakdown";
import ComposureReview from "./ComposureReview";
import { useComposure } from "../composureStore";

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

  return (
    <div className="daily-review-workspace">
      <div className="daily-review-workspace__top"><div><h2>{selectedReview ? formatDayKey(selectedReview.date) : "Today’s review"}</h2><p>{selectedReview ? "Saved reflection" : "Generated from today’s activity"}</p></div><Link to="/insights/analysis">Explore in Analysis →</Link></div>
      <div className="daily-review-workspace__columns">
        <section className="daily-review-main" aria-label="Daily execution review">
          <div className="daily-review-summary"><strong>{displayed.score}%</strong><span>Execution score<br /><small>Tasks · Habits · Focus · Workout</small></span></div>
          {displayed.breakdown?.length ? <ReviewBreakdown breakdown={displayed.breakdown} compact /> : <p>Contribution details were not stored for this older review.</p>}
          {!selectedReview && review.todayWorkout ? <p className="review-workout">Training: {review.todayWorkout.workout}</p> : null}
          <div className="daily-review-reflections">
            <section><h3>What went well</h3>{displayed.wins?.length ? <ul>{displayed.wins.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No wins recorded for this day.</p>}</section>
            <section><h3>What to adjust</h3>{displayed.improvements?.length ? <ul>{displayed.improvements.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No improvements recorded for this day.</p>}</section>
          </div>
          {selectedReview ? <Link to="/insights/daily">Back to today</Link> : <div className="daily-composure-section"><div className="section-header"><h2>Composure</h2><p>Reflect on your own response under pressure.</p></div><ComposureReview todayOnly embedded /></div>}
        </section>
        <aside className="daily-review-history" aria-label="Browse saved reviews">
          <h3>Previous reviews</h3>
          {history.length ? <div className="review-history">{history.slice().reverse().map((day) => <Link className="history-item" key={day.date} to={`/insights/daily?date=${day.date}`} aria-current={day.date === selectedDate ? "date" : undefined}>
            <span>{formatDayKey(day.date)}</span><small>{composureByDate.get(day.date)?.composureRating ? `Composure ${composureByDate.get(day.date).composureRating}/5` : ""}</small><strong>{day.score}%</strong>
          </Link>)}</div> : <p>No saved reviews yet.</p>}
        </aside>
      </div>
    </div>
  );
}
