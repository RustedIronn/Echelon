import { EmptyState, PanelHeader } from "@ui";
import TodayTaskRow from "./TodayTaskRow";

export default function NextUp({ items, onFocus, onToggle, limit = 3 }) {
  const next = items.slice(0, limit);

  return (
    <section className="next-up-card">
      <PanelHeader eyebrow="Queue" title="Next up" description={`The next ${limit} workable actions.`} />
      {next.length ? (
        <div className="today-task-list">
          {next.map((task, index) => (
            <TodayTaskRow
              key={task.id}
              task={task}
              onFocus={onFocus}
              onToggle={() => onToggle(task)}
              status={index === 0 ? "next" : "later"}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No tasks waiting"
          description="The current mission is the only thing left."
        />
      )}
    </section>
  );
}
