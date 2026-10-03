import { Check, MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ContextMenu } from "@ui";

import { categories } from "../js/scheduleCategories.js";
import { getScheduleItemDuration } from "../js/scheduleTime.js";

export default function ScheduleBranch({ event, toggleTask, onFocus, current, next, past, dayComplete = false }) {
  const { task, x, y, width, side } = event;
  const category = categories[task.category] ?? categories.foundation;
  const Icon = category.icon;
  const EventIcon = task.done ? Check : Icon;
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
  const status = task.done ? "Complete" : current ? "Active now" : next ? "Up next" : past ? "Passed" : "Upcoming";
  const actions = [
    ...(onFocus ? [{ id: "focus", label: "Focus on this", disabled: task.done, onSelect: () => onFocus(task) }] : []),
    { id: "toggle", label: task.done ? "Reopen activity" : "Mark complete", onSelect: toggle },
  ];

  return (
    <ContextMenu label={`Actions for ${task.title}`} items={actions}>
      {({ contextProps, triggerProps }) => (
        <article
          className={`schedule-branch schedule-branch--${side} ${task.done ? "is-complete" : ""} ${current ? "is-current" : ""} ${next ? "is-next" : ""} ${past ? "is-past" : ""} ${dayComplete ? "is-day-complete" : ""} ${response ? `is-${response}` : ""}`.trim()}
          style={{
            "--branch-x": `${x}px`,
            "--branch-y": `${y}px`,
            "--branch-width": `${width}px`,
            "--category-color": category.color,
            "--category-bg": category.background,
          }}
          {...contextProps}
        >
          <button
            type="button"
            className="schedule-branch__activity"
            aria-pressed={task.done}
            aria-current={current ? "true" : undefined}
            aria-label={`${task.title}, ${category.name}, ${task.start} to ${task.end}. ${status}`}
            onClick={toggle}
          >
            <span className="schedule-branch__meta">
              <time>{task.start}–{task.end}</time>
              <span>{duration}m · {status}</span>
            </span>
            <span className="schedule-branch__copy">
              <span className="schedule-branch__category"><EventIcon size={14} aria-hidden="true" />{category.name}</span>
              <strong>{task.title}</strong>
              <span>{task.description}</span>
            </span>
          </button>
          <button {...triggerProps}><MoreVertical size={18} aria-hidden="true" /></button>
        </article>
      )}
    </ContextMenu>
  );
}
