import { Card } from "@components/ui";

import { useWorkout } from "@store/useWorkout";

import { getWorkoutStats, getWorkoutStreak } from "@utils/workoutAnalyzer";

export default function WorkoutStats() {
  const workouts = useWorkout((state) => state.sessions);
  const streak = getWorkoutStreak(workouts);
  const stats = getWorkoutStats(workouts);

  return (
    <Card>
      <div className="section-header">
        <h2>Training Stats</h2>

        <p>Your consistency over time.</p>
      </div>

      <div className="stats-grid">
        <div>
          <strong>{stats.totalWorkouts}</strong>

          <span>Workouts</span>
        </div>

        <div>
          <strong>{stats.totalMinutes}</strong>

          <span>Minutes</span>
        </div>

        <div>
          <strong>{stats.mostTrained}</strong>

          <span>Most Trained</span>
        </div>

        <div>
          <strong>🔥 {streak}</strong>

          <span>Day Streak</span>
        </div>
      </div>
    </Card>
  );
}
