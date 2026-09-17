import { PageTitle } from "@ui";

import FocusAnalytics from "@features/focus/components/FocusAnalytics";
import HabitAnalytics from "@features/habits/components/HabitAnalytics";
import WeeklyInsight from "@/features/analytics/components/WeeklyInsight";
import WorkoutAnalytics from "@features/workout/components/WorkoutAnalytics";

export default function Analytics() {
  return (
    <div className="page">
      <PageTitle
        label="INSIGHTS"
        title="Analytics"
        description="Understand your progress."
      />

      <WeeklyInsight />

      <FocusAnalytics />

      <HabitAnalytics />

      <WorkoutAnalytics />
    </div>
  );
}
