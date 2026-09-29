export default function ExerciseCard({ exercise, index }) {
  return (
    <article className="exercise-card">
      <span>{String(index + 1).padStart(2, "0")}</span>

      <div>
        <h3>{exercise.name}</h3>

        <p>
          {exercise.mode === "manual" ? "Complete manually" : `${exercise.workSeconds ?? exercise.duration}s ${exercise.mode === "hold" ? "hold" : exercise.mode === "duration" ? "activity" : "work"}`}
          {" • "}
          {exercise.restSeconds ?? exercise.rest}s rest
        </p>

        <p className="exercise-description">{exercise.description}</p>
      </div>
    </article>
  );
}
