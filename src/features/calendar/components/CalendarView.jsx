import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Dumbbell, ListTodo, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { Button, EmptyState, PageTitle } from "@ui";
import { formatDayKey, getToday } from "@/shared/date";
import { usePlanner } from "@features/planner/store";
import { toFocusMission } from "@features/planner/tasks";
import { useFocusSurface } from "@features/focus/surface";
import { useToday } from "@features/schedule/todayStore";
import { useWorkout } from "@features/workout/store";
import { deriveCalendarEvents, groupCalendarEvents } from "../events";
import { CALENDAR_WEEKDAYS, getCalendarMonth, getMonthLabel, shiftCalendarMonth } from "../month";

const sourceMeta = {
  planner: { label: "Planner", icon: ListTodo },
  workout: { label: "Workout", icon: Dumbbell },
  schedule: { label: "Routine", icon: CalendarDays },
};

export default function CalendarView() {
  const openFocus = useFocusSurface((state) => state.openFor);
  const now = new Date();
  const today = getToday(now);
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const plannerTasks = usePlanner((state) => state.document.tasks);
  const scheduleTasks = useToday((state) => state.tasks);
  const workoutSessions = useWorkout((state) => state.sessions);
  const days = useMemo(() => getCalendarMonth(visibleMonth.year, visibleMonth.month), [visibleMonth]);
  const dates = useMemo(() => days.filter(Boolean).map((day) => day.date), [days]);
  const events = useMemo(() => deriveCalendarEvents({ plannerTasks, workoutSessions, scheduleTasks, dates, today }), [plannerTasks, workoutSessions, scheduleTasks, dates, today]);
  const eventsByDate = useMemo(() => groupCalendarEvents(events), [events]);
  const agenda = eventsByDate.get(selectedDate) ?? [];

  const moveMonth = (offset) => {
    const month = shiftCalendarMonth(visibleMonth, offset);
    setVisibleMonth(month);
    setSelectedDate(getToday(new Date(month.year, month.month, 1)));
  };

  const selectToday = () => {
    const date = new Date();
    setVisibleMonth({ year: date.getFullYear(), month: date.getMonth() });
    setSelectedDate(getToday(date));
  };

  return (
    <div className="page calendar-page">
      <PageTitle label="TIME MAP" title="Calendar" description="Plans, training, and your daily routine in one derived view." />

      <div className="calendar-workspace">
        <section className="calendar-month" aria-label={getMonthLabel(visibleMonth)}>
          <header className="calendar-month__header">
            <div>
              <span>Month</span>
              <h2 aria-live="polite">{getMonthLabel(visibleMonth)}</h2>
            </div>
            <div>
              <Button variant="tertiary" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></Button>
              <Button variant="secondary" onClick={selectToday}>Today</Button>
              <Button variant="tertiary" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight size={18} /></Button>
            </div>
          </header>

          <div className="calendar-grid" role="grid" aria-label={getMonthLabel(visibleMonth)}>
            {CALENDAR_WEEKDAYS.map((weekday) => <span className="calendar-weekday" role="columnheader" key={weekday}>{weekday}</span>)}
            {days.map((day, index) => {
              if (!day) return <span className="calendar-day is-empty" role="gridcell" key={`empty:${index}`} />;
              const dayEvents = eventsByDate.get(day.date) ?? [];
              const sources = new Set(dayEvents.map((event) => event.source));
              return (
                <button
                  type="button"
                  role="gridcell"
                  key={day.date}
                  className={`calendar-day ${day.date === today ? "is-today" : ""} ${day.date === selectedDate ? "is-selected" : ""}`.trim()}
                  aria-selected={day.date === selectedDate}
                  aria-label={`${formatDayKey(day.date, { weekday: "long" })}, ${dayEvents.length} calendar items`}
                  onClick={() => setSelectedDate(day.date)}
                >
                  <span>{day.day}</span>
                  <span className="calendar-day__signals" aria-hidden="true">
                    {[...sources].map((source) => <i className={`is-${source}`} key={source} />)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="calendar-agenda">
          <header>
            <div>
              <span>{selectedDate === today ? "Today" : "Selected day"}</span>
              <h2>{formatDayKey(selectedDate, { weekday: "long" })}</h2>
            </div>
            <Link className="calendar-add" to={`/plan/planner?date=${selectedDate}&capture=1`} aria-label={`Add Planner item for ${formatDayKey(selectedDate)}`}><Plus size={18} /></Link>
          </header>

          {agenda.length ? (
            <div className="calendar-agenda__list">
              {agenda.map((event) => {
                const meta = sourceMeta[event.source];
                const Icon = meta.icon;
                const plannerTask = event.source === "planner"
                  ? plannerTasks.find((task) => `planner:${task.id}` === event.id)
                  : null;
                const focusMission = plannerTask && !plannerTask.completedAt
                  ? toFocusMission(plannerTask)
                  : null;
                return (
                  <div className={`calendar-event calendar-event--${event.source}`} key={event.id}>
                  <Link className="calendar-event__main" to={event.href}>
                    <span className="calendar-event__icon"><Icon size={17} aria-hidden="true" /></span>
                    <span className="calendar-event__copy">
                      <small>{event.time ? `${event.time} · ` : ""}{meta.label}</small>
                      <strong>{event.title}</strong>
                    </span>
                    <span className={`calendar-event__status ${event.status === "completed" ? "is-completed" : ""}`.trim()}>{event.status}</span>
                  </Link>
                  {focusMission ? <Button variant="tertiary" onClick={() => openFocus(focusMission)} aria-label={`Focus on ${focusMission.title}`}>Focus</Button> : null}
                  </div>
                );
              })}
            </div>
          ) : <EmptyState compact title="Nothing scheduled" description="Use + to add a Planner item for this day." />}
        </aside>
      </div>
    </div>
  );
}
