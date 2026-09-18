import { generateWeeklyInsights } from "../insights";
import useDailyReviews from "@features/review/store";
import { formatDayKey } from "@/shared/date";

export default function WeeklyInsight() {
  const { history } = useDailyReviews();

  const insight = generateWeeklyInsights(history);

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

          <strong>{insight.best ? formatDayKey(insight.best.date) : "-"}</strong>
        </div>

        <div>
          <span>Lowest Day</span>

          <strong>{insight.worst ? formatDayKey(insight.worst.date) : "-"}</strong>
        </div>
      </div>
    </section>
  );
}
