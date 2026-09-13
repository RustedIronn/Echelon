// Single source of truth for the daily execution-score weighting.
// Both DayProgress's quick-glance score and Review's detailed breakdown
// use this — previously each had its own copy of these weights, which
// meant a change to one would silently not apply to the other.
const safePercent = (value) => {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? Math.min(Math.max(numeric, 0), 100) : 0;
};

export function weightedScore({ taskScore, habitScore, focusMinutes, workoutScore }) {
  const safeFocusMinutes = Number(focusMinutes);
  const focusScore = Number.isFinite(safeFocusMinutes)
    ? Math.min(Math.max(safeFocusMinutes, 0) / 240, 1) * 100
    : 0;

  return Math.round(
    safePercent(taskScore) * 0.45 +
      safePercent(habitScore) * 0.25 +
      focusScore * 0.2 +
      safePercent(workoutScore) * 0.1,
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
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeHabits = Array.isArray(habits) ? habits : [];

  const taskScore = safeTasks.length
    ? (safeTasks.filter((task) => task?.done).length / safeTasks.length) * 100
    : 0;

  const habitScore = safeHabits.length
    ? (safeHabits.filter((habit) => habit?.done).length / safeHabits.length) * 100
    : 0;

  const workoutScore = hasWorkout ? 100 : 0;

  return weightedScore({ taskScore, habitScore, focusMinutes, workoutScore });
}
