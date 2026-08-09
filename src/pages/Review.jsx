import { PageTitle, Card } from "@ui";
import { useToday } from "@features/schedule/today";
import { useHabits } from "@features/habits/store";
import { useFocus } from "@features/focus/store";
import { useWorkout } from "@features/workout/store";
import { getWorkoutStats } from "@features/workout/analyzer";
import { generateReview } from "@features/review/analyzer";
import useReview from "@features/review/store";

import ReviewBreakdown from "@features/review/components/ReviewBreakdown";
import { computeReviewBreakdown } from "@features/review/breakdown";

export default function Review() {
  const { tasks } = useToday();

  const { habits } = useHabits();

  const { sessions } = useFocus();

  const workouts = useWorkout((state) => state.sessions);
  const workoutStats = getWorkoutStats(workouts);

  const review = generateReview({
    tasks,
    habits,
    sessions,
    workoutStats,
  });

  const breakdown = computeReviewBreakdown({
    tasks,
    habits,
    sessions,
    workoutCompleted: review.workoutCompleted,
  });

  const { history } = useReview(review);

  return (
    <div className="page">
      <PageTitle
        label="REFLECTION"
        title="Review"
        description="Learn from the day."
      />

      <Card>
        <div className="section-header">
          <h2>Automated Review</h2>

          <p>Generated from today's execution.</p>
        </div>

        <div className="review-score">
          <strong>{review.score}%</strong>

          <span>Execution Score</span>
        </div>

        <ReviewBreakdown breakdown={breakdown} />

        {review.todayWorkout && (
          <div className="review-workout">
            <h3>Training</h3>

            <p>{review.todayWorkout.title}</p>
          </div>
        )}

        <div className="review-section">
          <h3>What went well</h3>

          <ul>
            {review.wins.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="review-section">
          <h3>Needs improvement</h3>

          <ul>
            {review.improvements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </Card>

      <Card>
        <div className="section-header">
          <h2>Recent Reviews</h2>

          <p>Your consistency over time.</p>
        </div>

        <div className="review-history">
          {history
            .slice(-7)
            .reverse()
            .map((day) => (
              <div className="history-item" key={`${day.date}-${day.score}`}>
                <span>{day.date}</span>

                <strong>{day.score}%</strong>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
