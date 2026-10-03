import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

import WeeklyInsight from "@features/insights/analysis/components/WeeklyInsight.jsx";
import { getCurrentWeekReviews } from "@features/insights/analysis/insights.js";
import useDailyReviews from "@features/insights/review/js/store.js";
import { formatDayKey } from "@/shared/date";

export default function InsightsOverview() {
  const { history } = useDailyReviews();
  const week = getCurrentWeekReviews(history);

  return (
    <div className="insights-overview">
      <section className="insights-overview-intro">
        <div>
          <span>This week · {week.length} of 7 days reviewed</span>
          <h2>This week</h2>
          <p>Daily reviews recorded so far.</p>
        </div>
        <div className="insights-overview-intro__actions">
          <Link to="/insights/daily">Review today <ArrowUpRight size={15} /></Link>
          <Link to="/insights/analysis">Open analysis <ArrowUpRight size={15} /></Link>
        </div>
      </section>

      <WeeklyInsight />

      <section className="insights-review-feed" aria-label="Recent daily reviews">
        <div className="section-header"><h2>Recent reviews</h2><p>Open a saved review.</p></div>
        {history.length ? history.slice(-5).reverse().map((review) => (
          <Link key={review.date} to={`/insights/daily?date=${review.date}`}><span>{formatDayKey(review.date)}</span><strong>{review.score}%</strong><ArrowUpRight size={15} aria-hidden="true" /></Link>
        )) : <p>No reviews recorded yet.</p>}
      </section>

    </div>
  );
}
