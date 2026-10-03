import { useEffect, useMemo, useRef, useState } from "react";

import ScheduleBranch from "./ScheduleBranch.jsx";
import { categories } from "../js/scheduleCategories.js";
import { createScheduleField } from "../js/scheduleField.js";
import { getCurrentScheduleItem, getScheduleMinutes } from "../js/scheduleTime.js";

function useFieldWidth() {
  const elementRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [elementRef, width];
}

export default function Timeline({ tasks, toggleTask, onFocus }) {
  const [now, setNow] = useState(() => new Date());
  const [fieldRef, fieldWidth] = useFieldWidth();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const clockCurrent = getCurrentScheduleItem(tasks, now);
  const current = clockCurrent?.done ? null : clockCurrent;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const next = tasks.find(
    (task) => !task.done && getScheduleMinutes(task.start) > currentMinutes,
  );
  const firstMinute = tasks.length ? getScheduleMinutes(tasks[0].start) : 0;
  const lastMinute = tasks.length ? getScheduleMinutes(tasks[tasks.length - 1].end) : firstMinute;
  const daySpan = Math.max(1, lastMinute - firstMinute);
  const dayPosition = Math.min(100, Math.max(0, ((currentMinutes - firstMinute) / daySpan) * 100));
  const completed = tasks.filter((task) => task.done).length;
  const dayComplete = tasks.length > 0 && completed === tasks.length;
  const activeLabel = current?.title ?? next?.title ?? "Schedule complete";
  const field = useMemo(() => createScheduleField(tasks, now, fieldWidth), [tasks, now, fieldWidth]);

  return (
    <>
      <div className="schedule-instrument" aria-label={`Day progress. ${completed} of ${tasks.length} blocks complete.`}>
        <div className="schedule-instrument__readout">
          <span>{current ? "On the desk" : next ? "Coming up" : "Day state"}</span>
          <strong>{activeLabel}</strong>
          <small>{completed}/{tasks.length} blocks closed</small>
        </div>
        <div className="schedule-instrument__track" aria-hidden="true">
          {tasks.map((task) => {
            const category = categories[task.category] ?? categories.foundation;
            const duration = Math.max(1, getScheduleMinutes(task.end) - getScheduleMinutes(task.start));
            return (
              <span
                key={task.id}
                className={task.done ? "is-complete" : ""}
                style={{ "--segment-color": category.color, flexGrow: duration }}
              />
            );
          })}
          <i style={{ left: `${dayPosition}%` }} />
        </div>
        <div className="schedule-instrument__scale" aria-hidden="true">
          <span>{tasks[0]?.start}</span>
          <span>local day</span>
          <span>{tasks[tasks.length - 1]?.end}</span>
        </div>
      </div>

      <div
        ref={fieldRef}
        className={`schedule-field ${field.compact ? "schedule-field--compact" : ""}`}
        style={{ "--field-height": `${field.height}px` }}
      >
        <svg className="schedule-field__geometry" viewBox={`0 0 ${field.width} ${field.height}`} preserveAspectRatio="none" aria-hidden="true">
          <path className="schedule-field__stem" d={field.stemPath} />
          {field.events.map((event) => (
            <g key={event.task.id} className={`schedule-field__branch schedule-field__branch--${event.side}`} style={{ "--branch-color": (categories[event.task.category] ?? categories.foundation).color }}>
              <path d={event.branchPath} />
              <circle cx={event.stemX} cy={event.y} r="5" />
            </g>
          ))}
        </svg>
        {field.events.map((event) => (
          <ScheduleBranch
            key={event.task.id}
            event={event}
              toggleTask={toggleTask}
              onFocus={onFocus}
            current={current?.id === event.task.id}
            next={next?.id === event.task.id}
            past={!event.task.done && getScheduleMinutes(event.task.end) <= currentMinutes}
            dayComplete={dayComplete && event.task.done}
          />
        ))}
      </div>
    </>
  );
}
