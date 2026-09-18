import { categories } from "../categories";
import { getScheduleItemHeight } from "../time";
import { Check } from "lucide-react";

export default function TimelineItem({ task, toggleTask, current }) {
  // Schedule normalization guarantees a known category. Keep this fallback as
  // a final render boundary for callers outside the persisted schedule flow.
  const category = categories[task.category] ?? categories.foundation;
  const Icon = category.icon;

  return (
    <div
      className={`
				timeline-item
				h-${getScheduleItemHeight(task)}
				${task.done ? "completed" : ""}
				${current ? "current" : ""}
			`}
      style={{
        "--category-color": category.color,
        "--category-bg": category.background,
      }}
      role="checkbox"
      tabIndex={0}
      aria-checked={task.done}
      aria-current={current ? "true" : undefined}
      aria-label={`${task.title}, ${category.name}, ${task.start} to ${task.end}`}
      onClick={() => toggleTask(task.id)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        toggleTask(task.id);
      }}
    >
      <div className="timeline-marker">
        <div className="dot">
          {task.done ? <Check size={14} /> : <Icon size={14} />}
        </div>
      </div>

      <div className="time">
        {task.start}-{task.end}
      </div>

      <div className="content">
        <div className="category-label">{category.name}</div>

        <h3>{task.title}</h3>

        <p>{task.description}</p>
      </div>
    </div>
  );
}
