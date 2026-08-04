import { Card } from "@components/ui";

import { useWorkout } from "@store/useWorkout";

export default function WorkoutHistory() {
  const workouts = useWorkout((state) => state.sessions);

  return (
    <Card>
      <div className="section-header">
        <h2>Recent Workouts</h2>

        <p>Your training consistency.</p>
      </div>

      <div className="workout-history">
        {workouts.length === 0 ? (
          <p>No workouts completed yet.</p>
        ) : (
          workouts
            .slice(-5)
            .reverse()
            .map((item, index) => (
              <div className="history-item" key={index}>
                <strong>{item.workout}</strong>

                <span>{item.date}</span>

                <span>
                  {Math.floor(item.duration / 60)}
                  min
                </span>
              </div>
            ))
        )}
      </div>
    </Card>
  );
}
