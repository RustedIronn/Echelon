import ExerciseCard from "./ExerciseCard";

export default function ExerciseList({ workout }) {
  return (
    <section className="workout-exercise-list">
      <header><h2>Exercises</h2><span>{workout.exercises.length} in sequence</span></header>

      <div className="stack">
        {workout.exercises.map((exercise, index) => (
          <ExerciseCard key={exercise.name} exercise={exercise} index={index} />
        ))}
      </div>
    </section>
  );
}
