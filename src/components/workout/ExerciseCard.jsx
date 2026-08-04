import { Card } from "@components/ui";

export default function ExerciseCard({ exercise, index }) {
  return (
    <Card>
      <div className="exercise-card">
        <span>{String(index + 1).padStart(2, "0")}</span>

        <h3>{exercise.name}</h3>

        <p>
          {exercise.duration}s work
          {" • "}
          {exercise.rest}s rest
        </p>
      </div>
    </Card>
  );
}
