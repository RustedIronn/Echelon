import { useEffect, useState } from "react";
import TimelineItem from "./TimelineItem";
import { categories } from "../js/scheduleCategories";
import { getCurrentScheduleItem, getScheduleMinutes } from "../js/scheduleTime";

export default function Timeline({ tasks, toggleTask, onFocus }) {
  const [now, setNow] = useState(() => new Date());

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

      <div className="timeline">
        {tasks.map((task) => (
          <div key={task.id}>
            <TimelineItem
              task={task}
              toggleTask={toggleTask}
              onFocus={onFocus}
              current={current?.id === task.id}
              next={next?.id === task.id}
              past={!task.done && getScheduleMinutes(task.end) <= currentMinutes}
              dayComplete={dayComplete && task.done}
            />
          </div>
        ))}
      </div>
    </>
  );
}
