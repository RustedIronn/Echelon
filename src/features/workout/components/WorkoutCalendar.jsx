import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button, Card, EmptyState } from "@ui";
import { getToday } from "@/shared/date";
import { DAY_ROLLOVER_EVENT } from "@/shared/dayRollover";
import { useWorkout } from "@features/workout/store";
import {
  formatWorkoutDate,
  getCalendarMonth,
  groupWorkoutHistoryByDate,
  shiftCalendarMonth,
} from "../history";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WorkoutCalendar({ embedded = false }) {
  const sessions = useWorkout((state) => state.sessions);
  const now = new Date();
  const [today, setToday] = useState(() => getToday(now));
  const [visibleMonth, setVisibleMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const historyByDate = groupWorkoutHistoryByDate(sessions);
  const days = getCalendarMonth(visibleMonth.year, visibleMonth.month);
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(visibleMonth.year, visibleMonth.month, 1));

  const moveMonth = (offset) => {
    setVisibleMonth((month) => shiftCalendarMonth(month, offset));
  };

  useEffect(() => {
    const handleDayRollover = () => {
      const nextDay = new Date();

      setToday(getToday(nextDay));
      setVisibleMonth({
        year: nextDay.getFullYear(),
        month: nextDay.getMonth(),
      });
    };

    window.addEventListener(DAY_ROLLOVER_EVENT, handleDayRollover);
    return () => window.removeEventListener(DAY_ROLLOVER_EVENT, handleDayRollover);
  }, []);

  return (
    <div className="stack">
      {!embedded ? <div className="section-header">
        <h2>Workout Calendar</h2>
        <p>Completed sessions by local calendar day.</p>
      </div> : null}

      {sessions.length === 0 ? (
        <Card>
          <EmptyState
            title="No completed workouts yet"
            description="Completed sessions will be marked here."
          />
        </Card>
      ) : null}

      <Card className="workout-calendar-card">
        <div className="workout-calendar-header">
          <Button variant="secondary" onClick={() => moveMonth(-1)} aria-label="Previous month">
            Previous
          </Button>
          <h3 aria-live="polite">{monthLabel}</h3>
          <Button variant="secondary" onClick={() => moveMonth(1)} aria-label="Next month">
            Next
          </Button>
        </div>

        <div className="workout-calendar" role="grid" aria-label={monthLabel}>
          {weekdays.map((day) => (
            <span className="workout-calendar-weekday" key={day} role="columnheader">
              {day}
            </span>
          ))}

          {days.map((day, index) => {
            if (!day) {
              return (
                <span
                  className="workout-calendar-day is-empty"
                  key={`empty-${index}`}
                  role="gridcell"
                />
              );
            }

            const completed = historyByDate[day.date] ?? [];
            const className = [
              "workout-calendar-day",
              day.date === today ? "is-today" : "",
              completed.length ? "has-workout" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return completed.length ? (
              <Link
                className={className}
                key={day.date}
                to={`/workouts/history/${day.date}`}
                role="gridcell"
                aria-label={`${formatWorkoutDate(day.date)}: ${completed.length} completed workout${completed.length === 1 ? "" : "s"}`}
              >
                <span>{day.day}</span>
                <i aria-hidden="true" />
              </Link>
            ) : (
              <span
                className={className}
                key={day.date}
                role="gridcell"
                aria-label={day.date === today ? `${formatWorkoutDate(day.date)}, today` : formatWorkoutDate(day.date)}
              >
                {day.day}
              </span>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
