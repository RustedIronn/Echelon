import { PageTitle } from "@ui";

import ProgressChart from "@/features/analytics/components/ProgressChart";
import FocusAnalytics from "@features/focus/components/FocusAnalytics";
import HabitAnalytics from "@features/habits/components/HabitAnalytics";
import WeeklyInsight from "@/features/analytics/components/WeeklyInsight";
import WorkoutAnalytics from "@features/workout/components/WorkoutAnalytics";

import { useStats } from "@/features/analytics/useStats";

export default function Analytics() {
  const { history } = useStats();

  return (
    <div className="page">
      <PageTitle
        label="INSIGHTS"
        title="Analytics"
        description="Understand your progress."
      />

      <WeeklyInsight />

      <ProgressChart history={history} />

      <FocusAnalytics />

      <HabitAnalytics />

      <WorkoutAnalytics />
    </div>
  );
}
