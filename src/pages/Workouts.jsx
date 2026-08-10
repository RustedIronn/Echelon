import { PageTitle, Card, Button } from "@ui";

import { useWorkout } from "@features/workout/store";
import { getTodayWorkout, getWorkoutDuration } from "@features/workout/utils";

import ExerciseList from "@features/workout/components/ExerciseList";
import WorkoutHistory from "@features/workout/components/WorkoutHistory";
import WorkoutSession from "@features/workout/components/WorkoutSession";
import WorkoutStats from "@features/workout/components/WorkoutStats";

export default function Workouts() {
  const workout = getTodayWorkout();

  const duration = getWorkoutDuration(workout);

  const { active, phase, startWorkout, savedProgress, continueWorkout, reset } =
    useWorkout();

  if (!workout) return null;

  return (
    <div className="page">
      <PageTitle
        label="TRAINING"
        title={workout.title}
        description={workout.description}
      />

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

                <Button
                  onClick={() => {
                    startWorkout(workout);
                  }}
                >
                  Start Workout
                </Button>
              </div>
            </Card>
          )}

          <ExerciseList workout={workout} />

          <WorkoutHistory />

          <WorkoutStats />
        </>
      )}
    </div>
  );
}
