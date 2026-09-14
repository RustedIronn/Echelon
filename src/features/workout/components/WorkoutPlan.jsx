import { useNavigate } from "react-router-dom";

import { Card, Button } from "@ui";
import { workouts } from "../constants";

export default function WorkoutPlan() {
  const navigate = useNavigate();

  return (
    <div className="workout-plan">
      {workouts.map((workout) => (
        <Card key={workout.day}>
          <p>{workout.day}</p>

          <h3>{workout.title}</h3>

          <p>{workout.description}</p>

          <Button
            onClick={() => {
              navigate("/workouts/today");
            }}
          >
            View Workout
          </Button>
        </Card>
      ))}
    </div>
  );
}
