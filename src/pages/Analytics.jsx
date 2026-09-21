import { useState } from "react";

import useDailyReviews from "@features/review/store";
import { useFocus } from "@features/focus/store";
import { useWorkout } from "@features/workout/store";
import AnalysisChart from "@features/analytics/components/AnalysisChart";
import { deriveAnalysisSeries } from "@features/analytics/series";

export default function Analytics() {
  const [range, setRange] = useState("30d");
  const reviews = useDailyReviews().history;
  const focusSessions = useFocus((state) => state.sessions);
  const workoutSessions = useWorkout((state) => state.sessions);
  const data = deriveAnalysisSeries({ reviews, focusSessions, workoutSessions }, range);

  return (
    <div className="stack insights-analysis">
      <div className="section-header insights-section-intro">
        <h2>Analysis</h2>
        <p>Recorded change over time. Missing reviews and activity are left blank.</p>
      </div>
      <div className="analysis-range" role="group" aria-label="Analysis range">
        {[{ id: "7d", label: "7 days" }, { id: "30d", label: "30 days" }, { id: "12w", label: "12 weeks" }].map((item) => <button type="button" key={item.id} aria-pressed={range === item.id} onClick={() => setRange(item.id)}>{item.label}</button>)}
      </div>
      <div className="analysis-charts">
        <AnalysisChart title="Execution score" description="Saved Daily Reviews; unreviewed days stay empty. Open a recorded day from the values below." data={data} dataKey="execution" unit="%" color="#6b4a73" maximum={100} hrefForPoint={range === "12w" ? null : (point) => `/insights/daily?date=${point.start}`} />
        <AnalysisChart title="Focus time" description="Minutes from completed Focus sessions." data={data} dataKey="focus" unit="min" color="#347e82" type="bar" />
        <AnalysisChart title="Habit completion" description="Habit values recorded with Daily Reviews; earlier days without a review are unknown." data={data} dataKey="habits" unit="%" color="#55816b" maximum={100} />
        <AnalysisChart title="Workout frequency" description="Completed workout sessions, including legacy history." data={data} dataKey="workouts" unit="sessions" color="#a56b59" type="bar" />
      </div>
    </div>
  );
}
