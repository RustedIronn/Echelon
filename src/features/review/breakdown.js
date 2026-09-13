import { getToday } from "../../shared/date.js";

export function computeReviewBreakdown({
  tasks = [],
  habits = [],
  sessions = [],
  workoutCompleted,
}) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeHabits = Array.isArray(habits) ? habits : [];
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const dayKey = getToday();

  const taskScore = safeTasks.length
    ? Math.round(
        (safeTasks.filter((task) => task?.done).length / safeTasks.length) * 100,
      )
    : 0;

  const habitScore = safeHabits.length
    ? Math.round(
        (safeHabits.filter((habit) => habit?.done).length / safeHabits.length) * 100,
      )
    : 0;

  const focusMinutes = Math.floor(
    safeSessions
      .filter((session) =>
        typeof session?.date === "string" && session.date.startsWith(dayKey),
      )
      .reduce(
        (total, session) => total + Math.max(Number(session.duration) || 0, 0),
        0,
      ) /
      60,
  );

  const focusScore = Math.min(Math.round((focusMinutes / 240) * 100), 100);

  return [
    {
      label: "Tasks",
      value: taskScore,
    },

    {
      label: "Habits",
      value: habitScore,
    },

    {
      label: "Focus",
      value: focusScore,
    },

    {
      label: "Workout",
      value: workoutCompleted ? 100 : 0,
    },
  ];
}
