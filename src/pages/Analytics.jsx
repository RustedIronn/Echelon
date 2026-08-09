import { PageTitle } from "@components/ui";

import ProgressChart from "@components/analytics/ProgressChart";
import FocusAnalytics from "@features/focus/components/FocusAnalytics";
import HabitAnalytics from "@features/habits/components/HabitAnalytics";
import WeeklyInsight from "@features/review/components/WeeklyInsight";
import WorkoutAnalytics from "@features/workout/components/WorkoutAnalytics";

import { useStats } from "@store/useStats";

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
