import { Card, EmptyState, PanelHeader } from "@ui";
import { getPrimaryMission, getMissionQueue } from "@features/focus/missions";
import TodayTaskRow from "./TodayTaskRow";

export default function CompactTodayTimeline({ tasks, onFocus, onToggle }) {
  const primary = getPrimaryMission(tasks);
  const queue = getMissionQueue(tasks);
  const nextId = queue[0]?.id;
  const queuedIds = new Set(queue.slice(0, 3).map((task) => task.id));
  const remaining = tasks.filter((task) => task.done || (!queuedIds.has(task.id) && task.id !== primary?.id));

  return (
    <Card material="soft" className="compact-timeline-card">
      <PanelHeader eyebrow="Routine" title="Rest of the day" description="Completed blocks and what follows the immediate queue." />
      {remaining.length ? <div className="compact-timeline">
        {remaining.map((task) => (
          <TodayTaskRow
            compact
            key={task.id}
            task={task}
            onFocus={onFocus}
            onToggle={onToggle}
            status={task.done ? "complete" : task.id === primary?.id ? "current" : task.id === nextId ? "next" : "later"}
          />
        ))}
      </div> : <EmptyState compact title="Nothing beyond the queue" description="Your current mission and Next Up contain the rest of today." />}
    </Card>
  );
}
