import { generateWeeklyInsights } from "@utils/weeklyInsights";
import useReview from "@hooks/useReview";

export default function WeeklyInsight() {
  const { history } = useReview();

  const insight = generateWeeklyInsights(history.slice(-7));

  return (
    <section className="card">
      <div className="section-header">
        <h2>Weekly Intelligence</h2>

        <p>Patterns from your behavior.</p>
      </div>

      <div className="insight-grid">
        <div>
          <span>Average Score</span>

          <strong>{insight.average}%</strong>
        </div>

        <div>
          <span>Focus Time</span>

          <strong>{Math.floor(insight.totalFocus / 60)}h</strong>
        </div>

        <div>
          <span>Best Day</span>

          <strong>{insight.best?.date || "-"}</strong>
        </div>

        <div>
          <span>Lowest Day</span>

          <strong>{insight.worst?.date || "-"}</strong>
        </div>
      </div>
    </section>
  );
}
