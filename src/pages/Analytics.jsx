import FocusAnalytics from "@features/focus/components/FocusAnalytics";
import HabitAnalytics from "@features/habits/components/HabitAnalytics";
import WorkoutAnalytics from "@features/workout/components/WorkoutAnalytics";

export default function Analytics() {
  return (
    <div className="stack insights-trends">
      <div className="section-header insights-section-intro">
        <h2>Trends</h2>
        <p>Longer-running patterns from the systems you already use.</p>
      </div>
      <FocusAnalytics />

      <HabitAnalytics />

      <WorkoutAnalytics />
    </div>
  );
}
