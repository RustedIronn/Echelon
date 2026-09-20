import { Card } from "@ui";
import { formatDayKey } from "@/shared/date";
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
  const composureReviews = useComposure((state) => state.data.reviews);
  const composureByDate = new Map(composureReviews.map((entry) => [entry.date, entry]));

  return (
    <div className="stack">
      <Card>
        <div className="section-header">
          <h2>Automated Review</h2>
          <p>Generated from today&apos;s execution.</p>
        </div>

        <div className="review-score">
          <strong>{review.score}%</strong>
          <span>Execution Score</span>
        </div>

        <ReviewBreakdown breakdown={breakdown} />

        {review.todayWorkout && (
          <div className="review-workout">
            <h3>Training</h3>
            <p>{review.todayWorkout.workout}</p>
          </div>
        )}

        <div className="review-section">
          <h3>What went well</h3>
          <ul>
            {review.wins.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>

        <div className="review-section">
          <h3>Needs improvement</h3>
          <ul>
            {review.improvements.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>

        <div className="daily-composure-section">
          <div className="section-header">
            <h2>Composure</h2>
            <p>Close the day by reflecting on your own response under pressure.</p>
          </div>
          <ComposureReview todayOnly embedded />
        </div>
      </Card>

      <Card>
        <div className="section-header">
          <h2>Recent Reviews</h2>
          <p>Your consistency over time.</p>
        </div>

        <div className="review-history">
          {history.slice(-7).reverse().map((day) => (
            <div className="history-item" key={`${day.date}-${day.score}`}>
              <span>{formatDayKey(day.date)}</span>
              <span>{composureByDate.get(day.date)?.composureRating ? `Composure ${composureByDate.get(day.date).composureRating}/5` : "Composure not rated"}</span>
              <strong>{day.score}%</strong>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
