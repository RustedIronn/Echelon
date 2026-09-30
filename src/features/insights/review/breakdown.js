import { getToday } from "../../../shared/date.js";
import { getFocusMinutesForDay } from "../../focus/utils.js";

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

  const focusMinutes = getFocusMinutesForDay(safeSessions, dayKey);

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
