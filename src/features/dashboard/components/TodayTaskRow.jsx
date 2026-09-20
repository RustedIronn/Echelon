import { Check, MoreVertical, Play } from "lucide-react";

import { Button, ContextMenu } from "@ui";
import { categories } from "@features/schedule/categories";
import { getScheduleItemDuration } from "@features/schedule/time";

export default function TodayTaskRow({ task, onFocus, onToggle, compact = false, status }) {
  const category = categories[task.category] ?? categories.foundation;
  const Icon = category.icon;
  const duration = getScheduleItemDuration(task);
  const actions = [
    {
      id: "focus",
      label: "Focus on this",
      onSelect: () => onFocus(task),
      disabled: task.done,
    },
    {
      id: "toggle",
      label: task.done ? "Reopen task" : "Mark complete",
      onSelect: () => onToggle(task.id),
    },
  ];

  return (
    <ContextMenu label={`Actions for ${task.title}`} items={actions}>
      {({ contextProps, triggerProps }) => (
        <div
          className={`today-task-row ${task.done ? "is-done" : ""} ${compact ? "is-compact" : ""} ${status ? `is-${status}` : ""}`.trim()}
          {...contextProps}
        >
          <span
            className="today-task-icon"
            style={{
              "--task-color": category.color,
              "--task-background": category.background,
            }}
            aria-hidden="true"
          >
            {task.done ? <Check size={16} /> : <Icon size={16} />}
          </span>
          <div className="today-task-copy">
            <span className="today-task-heading">
              <strong>{task.title}</strong>
              {status ? <small>{task.done ? "Complete" : status}</small> : null}
            </span>
            <span>{task.start}–{task.end} · {duration}m · {category.name}</span>
          </div>
          {!compact && !task.done ? (
            <Button
              variant="secondary"
              className="today-task-focus"
              onClick={() => onFocus(task)}
            >
              <Play size={14} aria-hidden="true" />
              Focus
            </Button>
          ) : null}
          <button {...triggerProps}>
            <MoreVertical size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </ContextMenu>
  );
}
