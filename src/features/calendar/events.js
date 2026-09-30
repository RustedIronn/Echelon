import { getToday, isValidDayKey } from "@/shared/date";
import { getWorkoutForDate } from "@features/workouts/utils";
import { sortWorkoutHistory } from "@features/workouts/history";

const compareEvents = (left, right) =>
  (left.time ?? "99:99").localeCompare(right.time ?? "99:99") ||
  left.source.localeCompare(right.source) ||
  left.title.localeCompare(right.title) ||
  left.id.localeCompare(right.id);

export function adaptPlannerEvents(tasks, today = getToday()) {
  if (!Array.isArray(tasks)) return [];

  return tasks.flatMap((task) => {
    if (
      !task ||
      !isValidDayKey(task.date) ||
      typeof task.id !== "string" ||
      !task.id.trim() ||
      typeof task.title !== "string" ||
      !task.title.trim()
    ) return [];
    const destination = task.date === today
      ? "/plan/planner/today"
      : task.date > today && !task.completedAt
        ? "/plan/planner/upcoming"
        : "/plan/planner";

    return [{
      id: `planner:${task.id}`,
      source: "planner",
      date: task.date,
      ...(/^([01]\d|2[0-3]):[0-5]\d$/.test(task.time) ? { time: task.time } : {}),
      title: task.title.trim(),
      status: task.completedAt ? "completed" : "planned",
      href: `${destination}?task=${encodeURIComponent(task.id)}`,
    }];
  });
}

export function adaptWorkoutEvents(sessions, dates) {
  const completedByDate = sortWorkoutHistory(sessions, "asc").reduce((map, session) => {
    const bucket = map.get(session.date) ?? [];
    bucket.push(session);
    map.set(session.date, bucket);
    return map;
  }, new Map());

  return dates.flatMap((date) => {
    const completed = completedByDate.get(date) ?? [];
    const events = completed.map((session, index) => ({
        id: `workout:completed:${session.id ?? `${date}:${index}`}`,
        source: "workout",
        date,
        title: session.workout,
        status: "completed",
        href: `/workouts/history/${date}`,
      }));

    const workout = getWorkoutForDate(date);
    if (workout) events.push({
      id: `workout:planned:${date}`,
      source: "workout",
      date,
      title: workout.title,
      status: "planned",
      href: `/workouts/today?date=${date}`,
    });

    return events;
  });
}

export function adaptScheduleEvents(tasks, dates, today = getToday()) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  if (!safeTasks.length) return [];
  const completed = safeTasks.filter((task) => task.done).length;

  return dates.map((date) => ({
    id: `schedule:${date}`,
    source: "schedule",
    date,
    title: "Daily routine",
    status: date === today ? `${completed}/${safeTasks.length} complete` : `${safeTasks.length} blocks`,
    href: "/plan/schedule",
  }));
}

export function deriveCalendarEvents({ plannerTasks, workoutSessions, scheduleTasks, dates, today }) {
  const visibleDates = Array.isArray(dates) ? dates.filter(isValidDayKey) : [];
  return [
    ...adaptPlannerEvents(plannerTasks, today).filter((event) => visibleDates.includes(event.date)),
    ...adaptWorkoutEvents(workoutSessions, visibleDates),
    ...adaptScheduleEvents(scheduleTasks, visibleDates, today),
  ].sort((left, right) => left.date.localeCompare(right.date) || compareEvents(left, right));
}

export function groupCalendarEvents(events) {
  return events.reduce((groups, event) => {
    const day = groups.get(event.date) ?? [];
    day.push(event);
    day.sort(compareEvents);
    groups.set(event.date, day);
    return groups;
  }, new Map());
}
