import { getTodayPlannerTasks, toFocusMission } from "@features/planner/tasks";
import { getCurrentScheduleItem } from "@features/schedule/time";

// Schedule owns the current time block; otherwise Planner priority can lead the day.
export function getTodayExecution(scheduleTasks, plannerTasks, now = new Date()) {
  const routine = Array.isArray(scheduleTasks) ? scheduleTasks.filter((task) => !task.done) : [];
  const oneOffs = getTodayPlannerTasks(Array.isArray(plannerTasks) ? plannerTasks : [], now)
    .filter((task) => !task.completedAt)
    .map((task) => ({ ...toFocusMission(task), priority: task.priority, source: "planner" }));
  const activeRoutine = getCurrentScheduleItem(routine, now);
  const highPriority = oneOffs.find((task) => task.priority === "high");
  const mission = activeRoutine ?? highPriority ?? routine[0] ?? oneOffs[0] ?? null;
  const next = [...oneOffs, ...routine].filter((task) => task.id !== mission?.id);
  return { mission, next };
}
