import { Card, Button } from "@ui";

import { useWorkout } from "@features/workout/store";
import { getTodayWorkout, getWorkoutDuration } from "@features/workout/utils";

import ExerciseList from "./ExerciseList";
import WorkoutSession from "./WorkoutSession";
import WorkoutStats from "./WorkoutStats";

export default function WorkoutToday() {
  const workout = getTodayWorkout();
  const duration = getWorkoutDuration(workout);
  const { active, phase, startWorkout, savedProgress, continueWorkout, reset } =
    useWorkout();

  if (!workout) return null;

  return (
    <div className="stack workout-today">
      <header className="workout-view-header">
        <p>TODAY</p>
        <h2>{workout.title}</h2>
        <span>{workout.description}</span>
      </header>

      {active || phase === "finished" ? (
        <WorkoutSession />
      ) : (
        <>
          {savedProgress?.workout ? (
            <Card>
              <div className="workout-header">
                <h2>Resume {savedProgress.workout.title}</h2>

                <div className="workout-stats">
                  <span>
                    Round {savedProgress.round}/{savedProgress.workout.rounds}
                  </span>

                  <span>{Math.floor(savedProgress.elapsed / 60)}m elapsed</span>
                </div>

                <div className="workout-actions">
                  <Button onClick={continueWorkout}>Continue Workout</Button>
                  <Button onClick={reset}>Discard</Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="workout-header">
                <h2>Today's Session</h2>

                <div className="workout-stats">
                  <span>{workout.exercises.length} Exercises</span>
                  <span>{workout.rounds} Rounds</span>
                  <span>~{duration} min</span>
                </div>

                <Button onClick={() => startWorkout(workout)}>
                  Start Workout
                </Button>
              </div>
            </Card>
          )}

          <ExerciseList workout={workout} />
          <WorkoutStats />
        </>
      )}
    </div>
  );
}
