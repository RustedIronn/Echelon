import { generateWeeklyInsights, getCurrentWeekReviews } from "../insights";
import useDailyReviews from "@features/insights/review/store.js";
import { getLocalWeekRange, getToday, parseDayKey } from "@/shared/date";

export default function WeeklyInsight() {
  const { history } = useDailyReviews();

  const insight = generateWeeklyInsights(history);
  const week = getCurrentWeekReviews(history);
  const monday = parseDayKey(getLocalWeekRange(new Date()).start);
  const byDate = new Map(week.map((review) => [review.date, review]));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + index);
    return { key: getToday(date), label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index] };
  });

  return (
    <section className="card">
      <div className="section-header">
        <h2>Reviewed days</h2>
        <p>Only days reviewed in the current local week are counted.</p>
      </div>

      <div className="insight-grid">
        <div>
          <span>Days reviewed</span>

          <strong>{week.length} / 7</strong>
        </div>

        <div>
          <span>Recorded focus</span>

          <strong>{Math.round(insight.totalFocus)} min</strong>
        </div>
      </div>
      <div className="insights-week-chart" role="img" aria-label="Execution scores for reviewed days this week; gaps are days without a review">
        {days.map((day) => {
          const score = byDate.get(day.key)?.score;
          return <div className="insights-week-chart__day" key={day.key} title={`${day.label}: ${score === undefined ? "No review" : `${score}%`}`}>
            <span>{score === undefined ? "—" : `${score}%`}</span>
            <div className="insights-week-chart__track">{score !== undefined ? <i style={{ height: `${Math.max(2, score)}%` }} /> : null}</div>
            <small>{day.label}</small>
          </div>;
        })}
      </div>
    </section>
  );
}
