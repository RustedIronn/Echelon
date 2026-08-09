import { useEffect } from "react";

import { useWorkout } from "@features/workout/store";

import { Card, Button } from "@ui";

export default function WorkoutSession() {
  const {
    active,
    workout,
    paused,
    togglePause,
    completeWorkout,
    completeExercise,
    round,
    exerciseIndex,
    phase,
    seconds,
    tick,
    reset,
  } = useWorkout();

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [active, tick]);

  if (!workout) return null;

  if (phase === "finished") {
    const minutes = Math.floor(useWorkout.getState().elapsed / 60);

    return (
      <Card>
        <div className="workout-session">
          <h1>Workout Complete 🔥</h1>

          <h2>{workout.title}</h2>

          <div className="completion-stats">
            <div>
              <strong>{workout.exercises.length}</strong>
              <span>Exercises</span>
            </div>

            <div>
              <strong>{workout.rounds}</strong>
              <span>Rounds</span>
            </div>

            <div>
              <strong>{minutes}</strong>
              <span>Minutes</span>
            </div>
          </div>

          <Button onClick={completeWorkout}>Finish</Button>
        </div>
      </Card>
    );
  }

  const exercise = workout.exercises[exerciseIndex];

  const nextExercise = workout.exercises[exerciseIndex + 1];

  const totalExercises = workout.rounds * workout.exercises.length;

  const completedExercises =
    (round - 1) * workout.exercises.length + exerciseIndex;

  const progress = Math.round((completedExercises / totalExercises) * 100);

  return (
    <Card>
      <div className="workout-session">
        <p className="workout-phase">
          {phase === "prepare"
            ? "GET READY"
            : phase === "rest"
              ? "REST"
              : "WORK"}
        </p>

        <h1>{workout.title}</h1>

        <p>
          Exercise {exerciseIndex + 1}/{workout.exercises.length}
        </p>

        <h2>{exercise?.name}</h2>

        <p className="exercise-instruction">{exercise?.description}</p>

        <p>
          Round {round}/{workout.rounds}
        </p>

        <div className="workout-progress">
          <div className="workout-progress-bar">
            <div
              className="workout-progress-fill"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          <span>{progress}% Complete</span>
        </div>

        <div className="workout-timer">{seconds}</div>

        {phase === "exercise" && (
          <Button onClick={completeExercise}>Done</Button>
        )}

        {nextExercise && <p>Next: {nextExercise.name}</p>}

        <div className="workout-actions">
          <Button onClick={togglePause}>{paused ? "Resume" : "Pause"}</Button>

          <Button onClick={reset}>Stop Workout</Button>
        </div>
      </div>
    </Card>
  );
}
