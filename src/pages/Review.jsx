import { PageTitle, Card } from "@components/ui";
import { useLockIn } from "@store/useLockIn";
import { useHabits } from "@store/useHabits";
import { useFocus } from "@store/useFocus";
import { generateReview } from "@utils/reviewAnalyzer";
import useReview from "@hooks/useReview";

export default function Review() {
  const { tasks } = useLockIn();

  const { habits } = useHabits();

  const { sessions } = useFocus();

  const review = generateReview({
    tasks,
    habits,
    sessions,
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
              <div className="history-item" key={day.date}>
                <span>{day.date}</span>

                <strong>{day.score}%</strong>
              </div>
            ))}
        </div>
      </Card>
      
    </div>
  );
}
