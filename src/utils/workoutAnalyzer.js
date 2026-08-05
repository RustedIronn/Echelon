export function getWorkoutStats(workouts = []) {
  const totalWorkouts = workouts.length;

  const totalSeconds = workouts.reduce(
    (total, item) => total + item.duration,
    0,
  );

  const workoutCount = {};

  workouts.forEach((item) => {
    workoutCount[item.workout] = (workoutCount[item.workout] || 0) + 1;
  });

  const mostTrained = Object.entries(workoutCount).sort(
    (a, b) => b[1] - a[1],
  )[0];

  const today = new Date().toISOString().split("T")[0];

  const todayWorkout = workouts.find((item) => item.date === today);

  return {
    totalWorkouts,

    totalMinutes: Math.floor(totalSeconds / 60),

    mostTrained: mostTrained ? mostTrained[0] : "None",

    completedToday: !!todayWorkout,

    todayWorkout,
  };
}

export function getWorkoutStreak(workouts = []) {
  if (workouts.length === 0) return 0;

  const dates = workouts
    .map((item) => item.date)
    .sort()
    .reverse();

  let streak = 0;

  let current = new Date();

  for (const date of dates) {
    const workoutDate = new Date(date);

    const diff = Math.floor((current - workoutDate) / (1000 * 60 * 60 * 24));

    if (diff === 0 || diff === 1) {
      streak++;

      current = workoutDate;
    } else {
      break;
    }
  }

  return streak;
}
