export function calculateExecutionScore({
  tasks,
  habits,
  focusMinutes,
  hasWorkout,
}) {
  const taskScore = tasks.length
    ? (tasks.filter((task) => task.done).length / tasks.length) * 100
    : 0;

  const habitScore = habits.length
    ? (habits.filter((habit) => habit.done).length / habits.length) * 100
    : 0;

  const focusScore = Math.min(focusMinutes / 240, 1) * 100;

  const workoutScore = hasWorkout ? 100 : 0;

  return Math.round(
    taskScore * 0.45 +
      habitScore * 0.25 +
      focusScore * 0.2 +
      workoutScore * 0.1,
  );
}
