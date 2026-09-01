import { categories } from "@/app/layout/categories";
import { getHeight } from "@/shared/duration";
import { Check } from "lucide-react";

export default function TimelineItem({ task, toggleTask, current }) {
  const category = categories[task.category];
  const Icon = category.icon;

  return (
    <div
      className={`
				timeline-item
				h-${getHeight(task)}
				${task.done ? "completed" : ""}
				${current ? "current" : ""}
			`}
      style={{
        "--category-color": category.color,
        "--category-bg": category.background,
      }}
      onClick={() => toggleTask(task.id)}
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
