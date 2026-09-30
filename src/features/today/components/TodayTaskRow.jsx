import { useEffect, useRef, useState } from "react";
import { Check, MoreVertical, Play } from "lucide-react";

import { Button, ContextMenu } from "@ui";
import { categories } from "@features/plan/schedule/categories.js";
import { getScheduleItemDuration } from "@features/plan/schedule/time.js";

export default function TodayTaskRow({ task, onFocus, onToggle, compact = false, status }) {
  const [response, setResponse] = useState(null);
  const responseTimer = useRef(null);
  const category = categories[task.category] ?? categories.foundation;
  const Icon = category.icon;
  const planner = task.source === "planner";
  const duration = planner ? null : getScheduleItemDuration(task);

  useEffect(() => () => window.clearTimeout(responseTimer.current), []);

  const toggle = () => {
    if (onToggle(task.id) === false) return;
    window.clearTimeout(responseTimer.current);
    setResponse(task.done ? "reopened" : "completed");
    responseTimer.current = window.setTimeout(() => setResponse(null), 560);
  };

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
      onSelect: toggle,
    },
  ];

  return (
    <ContextMenu label={`Actions for ${task.title}`} items={actions}>
      {({ contextProps, triggerProps }) => (
        <div
          className={`today-task-row ${task.done ? "is-done" : ""} ${compact ? "is-compact" : ""} ${status ? `is-${status}` : ""} ${response ? `is-${response}` : ""}`.trim()}
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
            <span>{planner ? `Planner · ${task.start === "Flexible" ? "Any time" : task.start} · ${task.priority} priority` : `${task.start}–${task.end} · ${duration}m · ${category.name}`}</span>
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
