// Single source of truth for the daily execution-score weighting.
// Both DayProgress's quick-glance score and Review's detailed breakdown
// use this — previously each had its own copy of these weights, which
// meant a change to one would silently not apply to the other.
export function weightedScore({ taskScore, habitScore, focusMinutes, workoutScore }) {
  const focusScore = Math.min(focusMinutes / 240, 1) * 100;

  return Math.round(
    taskScore * 0.45 + habitScore * 0.25 + focusScore * 0.2 + workoutScore * 0.1,
  );
}

// Convenience wrapper for callers (like DayProgress) that just want a quick
// score from raw tasks/habits and a simple "did any workout happen today" flag.
//
// Note: this treats ANY workout today as full credit. Review's score is
// stricter — it only counts a workout if one was actually required today
// (i.e. today isn't a scheduled recovery/rest day). That's an intentional
// difference, not an oversight — see features/review/analyzer.js.
export function calculateExecutionScore({ tasks, habits, focusMinutes, hasWorkout }) {
  const taskScore = tasks.length
    ? (tasks.filter((task) => task.done).length / tasks.length) * 100
    : 0;

  const habitScore = habits.length
    ? (habits.filter((habit) => habit.done).length / habits.length) * 100
    : 0;

  const workoutScore = hasWorkout ? 100 : 0;

  return weightedScore({ taskScore, habitScore, focusMinutes, workoutScore });
}
