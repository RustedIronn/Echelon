import { useEffect, useState } from "react";

import { Card, Button, EmptyState } from "@ui";

import { useWorkout } from "@features/workout/store";
import {
  getDefaultWorkoutPlanDate,
  getWorkoutDuration,
  getWorkoutForDate,
  shiftWorkoutPlanDate,
} from "@features/workout/utils";
import { DAY_ROLLOVER_EVENT } from "@/shared/dayRollover";

import ExerciseList from "./ExerciseList";
import WorkoutSession from "./WorkoutSession";
import WorkoutStats from "./WorkoutStats";
import { formatWorkoutDate } from "../history";
import {
  deriveCurrentExerciseState,
  WORKOUT_TRACKING_VERSION,
} from "../tracking";

export default function WorkoutToday() {
  const [today, setToday] = useState(() => getDefaultWorkoutPlanDate());
  const [selectedDate, setSelectedDate] = useState(today);
  const workout = getWorkoutForDate(selectedDate);
  const duration = getWorkoutDuration(workout);
  const { active, phase, startWorkout, savedProgress, continueWorkout, reset } =
    useWorkout();
  const savedTracking = savedProgress?.tracking;
  const savedExercise =
    savedTracking?.version === WORKOUT_TRACKING_VERSION
      ? deriveCurrentExerciseState(
          savedTracking,
          savedProgress.exerciseIndex,
        ).exercise
      : null;

  useEffect(() => {
    const handleRollover = () => {
      const nextToday = getDefaultWorkoutPlanDate();
      setSelectedDate((current) => (current === today ? nextToday : current));
      setToday(nextToday);
    };

    window.addEventListener(DAY_ROLLOVER_EVENT, handleRollover);
    return () => window.removeEventListener(DAY_ROLLOVER_EVENT, handleRollover);
  }, [today]);

  const moveSelectedDate = (offset) => {
    setSelectedDate(
      (current) => shiftWorkoutPlanDate(current, offset) ?? current,
    );
  };

  const scheduleLabel =
    selectedDate === today
      ? "Scheduled today"
      : selectedDate === shiftWorkoutPlanDate(today, -1)
        ? "Scheduled yesterday"
        : selectedDate === shiftWorkoutPlanDate(today, 1)
          ? "Scheduled tomorrow"
          : `Planned for ${formatWorkoutDate(selectedDate)}`;

  return (
    <div className="stack workout-today">
      <nav className="workout-plan-date-nav" aria-label="Workout plan date">
        <Button onClick={() => moveSelectedDate(-1)}>← Previous Day</Button>
        <div>
          <strong>{formatWorkoutDate(selectedDate)}</strong>
          {selectedDate !== today ? (
            <Button
              className="tracked-secondary-button"
              onClick={() => setSelectedDate(today)}
            >
              Today
            </Button>
          ) : null}
        </div>
        <Button onClick={() => moveSelectedDate(1)}>Next Day →</Button>
      </nav>

      <header className="workout-view-header">
        <p>{selectedDate === today ? "TODAY" : "SELECTED PLAN"}</p>
        <h2>{workout?.title ?? "No workout prescribed"}</h2>
        <span>
          {workout?.description ?? "There is no workout in the current plan for this day."}
        </span>
        <small className="workout-plan-schedule-label">{scheduleLabel}</small>
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
                  {savedExercise ? (
                    <>
                      <span>
                        Exercise {savedProgress.exerciseIndex + 1}/
                        {savedTracking.exercises.length}
                      </span>
                      <span>
                        {savedExercise.sets.filter((set) => set.completed).length}/
                        {savedExercise.sets.length} sets complete
                      </span>
                    </>
                  ) : (
                    <span>
                      Round {savedProgress.round}/{savedProgress.workout.rounds}
                    </span>
                  )}

                  <span>{Math.floor(savedProgress.elapsed / 60)}m elapsed</span>
                </div>

                <div className="workout-actions">
                  <Button onClick={continueWorkout}>Continue Workout</Button>
                  <Button onClick={reset}>Discard</Button>
                </div>
              </div>
            </Card>
          ) : workout ? (
            <Card>
              <div className="workout-header">
                <h2>
                  {selectedDate === today ? "Today's Session" : "Selected Plan"}
                </h2>

                <div className="workout-stats">
                  <span>{workout.exercises.length} Exercises</span>
                  <span>{workout.rounds} Rounds</span>
                  <span>~{duration} min</span>
                </div>

                <Button onClick={() => startWorkout(workout, selectedDate)}>
                  {selectedDate === today
                    ? "Start Workout"
                    : "Start This Workout"}
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <EmptyState
                title="No workout prescribed"
                description="Browse another day or return to Today."
              />
            </Card>
          )}

          {workout ? <ExerciseList workout={workout} /> : null}
          <WorkoutStats />
        </>
      )}
    </div>
  );
}
