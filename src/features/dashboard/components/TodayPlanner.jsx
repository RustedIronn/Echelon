import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Circle, Crosshair, ListTodo } from "lucide-react";

import { Button, Card, EmptyState } from "@ui";
import { usePlanner } from "@features/planner/store";
import { getTodayPlannerTasks, toFocusMission } from "@features/planner/tasks";
import { useFocusSurface } from "@features/focus/surface";

export default function TodayPlanner() {
  const openFocus = useFocusSurface((state) => state.openFor);
  const { document, toggleTask } = usePlanner();
  const tasks = getTodayPlannerTasks(document.tasks);
  const open = tasks.filter((task) => !task.completedAt);

  return (
    <Card material="soft" className="today-planner-strip">
      <div className="today-planner-heading">
        <div><span><ListTodo size={15} aria-hidden="true" /> One-offs due today</span><strong>{open.length ? `${open.length} waiting beside the routine` : "Planner is clear"}</strong></div>
        <Link to="/planner/today">Open Planner <ArrowUpRight size={14} /></Link>
      </div>
      {tasks.length ? (
        <div className="today-planner-items">
          {tasks.slice(0, 4).map((task) => (
            <article className={task.completedAt ? "is-complete" : ""} key={task.id}>
              <button type="button" onClick={() => toggleTask(task.id)} aria-label={task.completedAt ? `Reopen ${task.title}` : `Complete ${task.title}`}>
                {task.completedAt ? <Check size={16} /> : <Circle size={16} />}
              </button>
              <div><strong>{task.title}</strong><small>{task.time || "Flexible"} · {task.priority}</small></div>
              {!task.completedAt ? <Button variant="ghost" onClick={() => openFocus(toFocusMission(task))}><Crosshair size={15} /> Focus</Button> : null}
            </article>
          ))}
        </div>
      ) : <EmptyState compact title="Nothing due from Planner" description="Your recurring routine still runs below." />}
    </Card>
  );
}
