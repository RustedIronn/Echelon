import { PageTitle } from "@components/ui";

import ProgressChart from "@components/analytics/ProgressChart";
import FocusAnalytics from "@components/analytics/FocusAnalytics";
import HabitAnalytics from "@components/analytics/HabitAnalytics";
import WeeklyInsight from "@components/analytics/WeeklyInsight";
import WorkoutAnalytics from "@components/analytics/WorkoutAnalytics";

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
