import { useToday } from "@/features/plan/schedule/js/todayStore";
import { PageTitle, Stage } from "@ui";
import CurrentMission from "@features/focus/components/CurrentMission.jsx";
import { useFocusSurface } from "@features/focus/js/surface.js";
import CompactTodayTimeline from "@features/today/components/CompactTodayTimeline.jsx";
import NextUp from "@features/today/components/NextUp.jsx";
import TodaySummaries from "@features/today/components/TodaySummaries.jsx";
import { getTodayExecution } from "@features/today/execution.js";
import { usePlanner } from "@features/plan/planner/js/plannerStore.js";

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
        <CompactTodayTimeline tasks={tasks} onFocus={openFocus} onToggle={toggleAction} />
        <TodaySummaries />
      </Stage>
    </div>
  );
}
