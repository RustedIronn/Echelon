export function computeReviewBreakdown({
  tasks,
  habits,
  sessions,
  workoutCompleted,
}) {
  const taskScore = tasks.length
    ? Math.round(
        (tasks.filter((task) => task.done).length / tasks.length) * 100,
      )
    : 0;

  const habitScore = habits.length
    ? Math.round(
        (habits.filter((habit) => habit.done).length / habits.length) * 100,
      )
    : 0;

  const focusMinutes = Math.floor(
    sessions.reduce((total, session) => total + session.duration, 0) / 60,
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
