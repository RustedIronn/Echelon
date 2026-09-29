import { categories } from "../categories";
import { getScheduleItemDuration, getScheduleItemHeight } from "../time";
import { Check, MoreVertical } from "lucide-react";
import { ContextMenu } from "@ui";
import { useEffect, useRef, useState } from "react";

export default function TimelineItem({ task, toggleTask, onFocus, current, next, past, dayComplete = false }) {
  // Schedule normalization guarantees a known category. Keep this fallback as
  // a final render boundary for callers outside the persisted schedule flow.
  const category = categories[task.category] ?? categories.foundation;
  const Icon = category.icon;
  const duration = getScheduleItemDuration(task);
  const [response, setResponse] = useState(null);
  const responseTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(responseTimer.current), []);

  const toggle = () => {
    if (toggleTask(task.id) === false) return;
    window.clearTimeout(responseTimer.current);
    setResponse(task.done ? "reopened" : "completed");
    responseTimer.current = window.setTimeout(() => setResponse(null), 560);
  };

  const actions = [
    ...(onFocus ? [{
      id: "focus",
      label: "Focus on this",
      disabled: task.done,
      onSelect: () => onFocus(task),
    }] : []),
    {
      id: "toggle",
      label: task.done ? "Reopen activity" : "Mark complete",
      onSelect: toggle,
    },
  ];

  const status = task.done
    ? "Complete"
    : current
      ? "Active now"
      : next
        ? "Up next"
        : past
          ? "Passed"
          : "Upcoming";

  return (
    <ContextMenu label={`Actions for ${task.title}`} items={actions}>
      {({ contextProps, triggerProps }) => (
        <div
          className={`timeline-item h-${getScheduleItemHeight(task)} ${task.done ? "completed" : ""} ${current ? "current" : ""} ${next ? "next" : ""} ${past ? "past" : ""} ${dayComplete ? "is-day-complete" : ""} ${response ? `is-${response}` : ""}`.trim()}
          style={{
            "--category-color": category.color,
            "--category-bg": category.background,
          }}
          {...contextProps}
        >
          <button
            type="button"
            className="timeline-activity"
            aria-pressed={task.done}
            aria-current={current ? "true" : undefined}
            aria-label={`${task.title}, ${category.name}, ${task.start} to ${task.end}. ${status}`}
            onClick={toggle}
          >
            <span className="timeline-marker" aria-hidden="true">
              <span className="dot">
                {task.done ? <Check size={14} /> : <Icon size={14} />}
              </span>
            </span>

            <span className="time">{task.start}–{task.end}</span>

            <span className="content">
              <span className="timeline-content-topline">
                <span className="category-label">{category.name}</span>
                <span className="timeline-status">{duration}m · {status}</span>
              </span>
              <strong>{task.title}</strong>
              <span className="timeline-description">{task.description}</span>
            </span>
          </button>

          <button {...triggerProps}>
            <MoreVertical size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </ContextMenu>
  );
}
