import { useNavigate } from "react-router-dom";

import { Card, Button } from "@components/ui";

import { getTodayWorkout } from "@utils/workout";

export default function TodayWorkout() {
  const navigate = useNavigate();

  const workout = getTodayWorkout();

  if (!workout) return null;

  return (
    <Card>
      <div className="today-workout">
        <p>Today's Training</p>

        <h2>{workout.title}</h2>

        <p>{workout.description}</p>

        <div className="workout-stats">
          <span>{workout.exercises.length} Exercises</span>

          <span>{workout.rounds} Rounds</span>
        </div>

        <Button
          onClick={() => {
            navigate("/workouts");
          }}
        >
          Start Workout
        </Button>
      </div>
    </Card>
  );
}
