import { useToday } from "@features/schedule/today";
import { PageTitle } from "@ui";

import CurrentMission from "@features/focus/components/CurrentMission";
import DayProgress from "@components/dashboard/DayProgress";
import StatsRow from "@components/dashboard/StatsRow";
import Timeline from "@features/schedule/components/Timeline";
import DailyOverview from "@components/dashboard/DailyOverview";

import NonNegotiables from "@components/cards/NonNegotiables";
import MinimumStandard from "@components/cards/MinimumStandard";

import WorkoutPlan from "@features/workout/components/WorkoutPlan";
import WorkoutSession from "@features/workout/components/WorkoutSession";
import WeekendPlan from "@features/schedule/components/WeekendPlan";
import TodayWorkout from "@features/workout/components/TodayWorkout";

export default function Today() {
  const { tasks, toggleTask } = useToday();

  return (
    <div className="page">
      <PageTitle
        label="DAILY SYSTEM"
        title="Today"
        description="Execute the plan. Improve the system."
      />

      <DailyOverview />

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <CurrentMission tasks={tasks} />

          <DayProgress tasks={tasks} />
        </div>

        <div className="dashboard-side">
          <StatsRow tasks={tasks} />
        </div>
      </div>

      <Timeline tasks={tasks} toggleTask={toggleTask} />

      <NonNegotiables />

      <MinimumStandard />

      <TodayWorkout />

      <WorkoutSession />

      <WeekendPlan />
    </div>
  );
}
