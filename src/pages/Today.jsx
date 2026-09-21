import { useToday } from "@/features/schedule/todayStore";
import { PageTitle, Stage } from "@ui";
import CurrentMission from "@/features/focus/components/CurrentMission";
import NextUp from "@/features/dashboard/components/NextUp";
import TodaySummaries from "@/features/dashboard/components/TodaySummaries";
import { useFocusSurface } from "@features/focus/surface";
import { usePlanner } from "@features/planner/store";
import { getTodayExecution } from "@features/dashboard/execution";

export default function Today() {
  const { tasks, toggleTask } = useToday();
  const openFocus = useFocusSurface((state) => state.openFor);
  const plannerTasks = usePlanner((state) => state.document.tasks);
  const togglePlannerTask = usePlanner((state) => state.toggleTask);
  const { mission, next } = getTodayExecution(tasks, plannerTasks);
  const toggleAction = (task) => task.source === "planner" ? togglePlannerTask(task.id) : toggleTask(task.id);

  return (
    <div className="page today-page">
      <PageTitle
        tone="command"
        label="DAILY SYSTEM"
        title="Today"
        description="What matters right now, and what comes next."
      />

      <Stage tone="command" className="today-stage">
        <CurrentMission mission={mission} onFocus={openFocus} />

        <NextUp items={next} onFocus={openFocus} onToggle={toggleAction} limit={2} />
        <TodaySummaries />
      </Stage>
    </div>
  );
}
