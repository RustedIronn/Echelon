import { getToday } from "./date";
import { getWorkoutStats } from "./workoutAnalyzer";

export function generateReview({ tasks, habits, sessions }) {
  const completedTasks = tasks.filter((task) => task.done).length;

  const taskScore = Math.round((completedTasks / tasks.length) * 100) || 0;

  const completedHabits = habits.filter((habit) => habit.done).length;

  const habitScore = Math.round((completedHabits / habits.length) * 100) || 0;

  const focusSeconds = sessions.reduce(
    (total, session) => total + session.duration,
    0,
  );

  const focusMinutes = Math.floor(focusSeconds / 60);

  const workoutStats = getWorkoutStats();

  const workoutScore = workoutStats.completedToday ? 100 : 0;

  const score = Math.round(
    taskScore * 0.45 +
      habitScore * 0.25 +
      Math.min(focusMinutes / 240, 1) * 100 * 0.2 +
      workoutScore * 0.1,
  );

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

  const workoutRequired =
    workoutStats.todayWorkout &&
    workoutStats.todayWorkout.title !== "Recovery" &&
    workoutStats.todayWorkout.title !== "Active Recovery" &&
    workoutStats.todayWorkout.title !== "Fun Movement";

  if (workoutRequired) {
    if (workoutScore === 100) {
      wins.push("Completed training session");
    } else {
      improvements.push("Complete today's workout");
    }
  }

  return {
    date: getToday(),

    score,

    wins,

    improvements,

    focusMinutes,

    workoutCompleted: workoutStats.completedToday,
  };
}
