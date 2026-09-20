import { Card } from "@ui";
import { Activity } from "lucide-react";

import { useWorkout } from "@features/workout/store";

import { getWorkoutStats, getWorkoutStreak } from "@features/workout/analyzer";

export default function WorkoutAnalytics() {
  const workouts = useWorkout((state) => state.sessions);

  const stats = getWorkoutStats(workouts);

  const streak = getWorkoutStreak(workouts);

  return (
    <Card>
      <div className="section-header">
        <h2>Training</h2>

        <p>Your physical consistency.</p>
      </div>

      <div className="analytics-grid">
        <div>
          <strong>{stats.totalWorkouts}</strong>

          <span>Workouts</span>
        </div>

        <div>
          <strong>{stats.totalMinutes}</strong>

          <span>Minutes</span>
        </div>

        <div>
          <strong className="workout-training-run">
            <Activity size={18} aria-hidden="true" />
            {streak}
          </strong>

          <span>Training run</span>
        </div>
      </div>
    </Card>
  );
}
