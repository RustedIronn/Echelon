import { getToday } from "@/shared/date";
import { weightedScore } from "@/shared/executionScore";

export function generateReview({ tasks, habits, sessions, workoutStats }) {
  const completedTasks = tasks.filter((task) => task.done).length;

  const taskScore = Math.round((completedTasks / tasks.length) * 100) || 0;

  const completedHabits = habits.filter((habit) => habit.done).length;

  const habitScore = Math.round((completedHabits / habits.length) * 100) || 0;

  const focusSeconds = sessions.reduce(
    (total, session) => total + (Number(session.duration) || 0),
    0,
  );

  const focusMinutes = Math.floor(focusSeconds / 60);

  const todayWorkout = workoutStats.todayWorkout;

  const workoutRequired =
    todayWorkout &&
    !["Recovery", "Active Recovery", "Fun Movement"].includes(
      todayWorkout.title,
    );

  const workoutScore = workoutRequired && workoutStats.completedToday ? 100 : 0;

  const score = weightedScore({
    taskScore,
    habitScore,
    focusMinutes,
    workoutScore,
  });

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
    date: getToday(),

    score,

    wins,

    improvements,

    focusMinutes,

    workoutCompleted: !!workoutStats.completedToday,

    workoutStats,

    todayWorkout,
  };
}
