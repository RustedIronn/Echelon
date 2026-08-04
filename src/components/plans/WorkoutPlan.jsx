import { workouts } from "@data/workouts";
import { Card } from "../ui";

export default function WorkoutPlan() {
  return (
    <Card>
      <div className="section-header">
        <h2>Weekly Workout</h2>

        <p>Train consistently, not perfectly.</p>
      </div>

      <div className="workout-grid">
        {workouts.map((workout) => (
          <div className="workout-item" key={workout.day}>
            <span>{workout.day}</span>

            <h3>{workout.title}</h3>

            <p>{workout.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
