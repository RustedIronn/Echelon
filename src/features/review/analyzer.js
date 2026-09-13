import { getToday } from "../../shared/date.js";
import { weightedScore } from "../../shared/executionScore.js";

export function generateReview({
  tasks = [],
  habits = [],
  sessions = [],
  workoutStats = {},
  scheduledWorkout = null,
}) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeHabits = Array.isArray(habits) ? habits : [];
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const today = getToday();

  const completedTasks = safeTasks.filter((task) => task?.done).length;

  const taskScore = safeTasks.length
    ? Math.round((completedTasks / safeTasks.length) * 100)
    : 0;

  const completedHabits = safeHabits.filter((habit) => habit?.done).length;

  const habitScore = safeHabits.length
    ? Math.round((completedHabits / safeHabits.length) * 100)
    : 0;

  const focusSeconds = safeSessions
    .filter((session) =>
      typeof session?.date === "string" && session.date.startsWith(today),
    )
    .reduce(
    (total, session) => total + Math.max(Number(session.duration) || 0, 0),
    0,
  );

  const focusMinutes = Math.floor(focusSeconds / 60);

  const todayWorkout = workoutStats?.todayWorkout || null;

  const workoutRequired =
    scheduledWorkout &&
    !["Recovery", "Active Recovery", "Fun Movement"].includes(
      scheduledWorkout.title,
    );

  const workoutScore = workoutRequired && workoutStats?.completedToday ? 100 : 0;

  const weighted = weightedScore({
    taskScore,
    habitScore,
    focusMinutes,
    workoutScore,
  });

  const score = workoutRequired
    ? weighted
    : Math.min(Math.round(weighted / 0.9), 100);

  const wins = [];

  const improvements = [];

  if (taskScore >= 80) {
    wins.push("Strong task execution");
  } else {
    improvements.push("Complete more planned tasks");
  }

  if (habitScore >= 80) {
    wins.push("Good habit consistency");
  } else {
    improvements.push("Protect your daily habits");
  }

  if (focusMinutes >= 120) {
    wins.push(`${focusMinutes} minutes of focused work`);
  } else {
    improvements.push("Increase deep work time");
  }

  if (workoutRequired) {
    if (workoutScore === 100) {
      wins.push("Completed training session");
    } else {
      improvements.push("Complete today's workout");
    }
  }

  return {
    date: today,

    score,

    wins,

    improvements,

    focusMinutes,

    workoutCompleted: !!workoutStats?.completedToday,

    workoutStats,

    todayWorkout,

    workoutRequired: !!workoutRequired,
  };
}
