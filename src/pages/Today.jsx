import { useLockIn } from "@store/useLockIn";
import { PageTitle } from "@components/ui";

import CurrentMission from "@components/dashboard/CurrentMission";
import DayProgress from "@components/dashboard/DayProgress";
import StatsRow from "@components/dashboard/StatsRow";
import Timeline from "@components/timeline/Timeline";

import NonNegotiables from "@components/cards/NonNegotiables";
import MinimumStandard from "@components/cards/MinimumStandard";

import WorkoutPlan from "@components/plans/WorkoutPlan";
import WorkoutSession from "@components/workout/WorkoutSession";
import WeekendPlan from "@components/plans/WeekendPlan";

export default function Today() {
  const { tasks, toggleTask} = useLockIn();

  return (
    <div className="page">
      <PageTitle
        label="DAILY SYSTEM"
        title="Today"
        description="Execute the plan. Improve the system."
      />

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

      <WorkoutPlan />

      <WorkoutSession />

      <WeekendPlan />
    </div>
  );
}
