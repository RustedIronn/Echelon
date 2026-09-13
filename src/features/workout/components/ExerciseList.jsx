import { Card } from "@ui";
import ExerciseCard from "./ExerciseCard";

export default function ExerciseList({ workout }) {
  return (
    <Card>
      <h2>Exercises</h2>

      <div className="stack">
        {workout.exercises.map((exercise, index) => (
          <ExerciseCard key={exercise.name} exercise={exercise} index={index} />
        ))}
      </div>
    </Card>
  );
}
