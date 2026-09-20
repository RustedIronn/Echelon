import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

import { EmptyState } from "@ui";
import WeeklyInsight from "@features/analytics/components/WeeklyInsight";
import useDailyReviews from "@features/review/store";
import { formatDayKey } from "@/shared/date";

export default function InsightsOverview() {
  const { history } = useDailyReviews();
  const latest = history.at(-1);

  return (
    <div className="insights-overview">
      <section className="insights-hero">
        <div>
          <span>Latest reflection</span>
          {latest ? (
            <>
              <strong>{latest.score}%</strong>
              <p>{formatDayKey(latest.date)} · Execution score</p>
            </>
          ) : (
            <EmptyState
              title="Your patterns will gather here"
              description="Complete a Daily Review when you’re ready."
            />
          )}
          <div className="insights-hero-actions">
            <Link to="/insights/daily">Review today <ArrowUpRight size={15} /></Link>
            <Link to="/insights/trends">Open trends <ArrowUpRight size={15} /></Link>
          </div>
        </div>
      </section>

      <WeeklyInsight />

    </div>
  );
}
