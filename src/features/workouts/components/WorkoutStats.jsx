import { Card } from "@ui";
import { Activity } from "lucide-react";

import { useWorkout } from "@features/workouts/js/store";

import { getWorkoutStats, getWorkoutStreak } from "@features/workouts/js/analyzer";

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
          <strong className="workout-training-run"><Activity size={18} aria-hidden="true" />{streak}</strong>

          <span>Training run</span>
        </div>
      </div>
    </Card>
  );
}
