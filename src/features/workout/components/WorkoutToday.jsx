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

  if (active || phase === "finished") {
    return <div className="workout-active-workspace"><WorkoutSession /></div>;
  }

  return (
    <div className="stack workout-today">
      <Card material="feature" shape="slab" className="workout-plan-console">
        <nav className="workout-plan-date-nav" aria-label="Workout plan date">
          <Button variant="secondary" onClick={() => moveSelectedDate(-1)}>← Previous</Button>
          <div><strong>{formatWorkoutDate(selectedDate)}</strong>{selectedDate !== today ? <Button variant="ghost" onClick={() => setSelectedDate(today)}>Today</Button> : null}</div>
          <Button variant="secondary" onClick={() => moveSelectedDate(1)}>Next →</Button>
        </nav>

        <div className="workout-plan-brief">
          <header className="workout-view-header">
            <p>{selectedDate === today ? "TODAY'S PLAN" : "SELECTED PLAN"}</p>
            <h2>{savedProgress?.workout ? `Resume ${savedProgress.workout.title}` : workout?.title ?? "Recovery day"}</h2>
            <span>{savedProgress?.workout ? "Your active snapshot is ready to continue." : workout?.description ?? "There is no prescribed workout for this day."}</span>
            <small className="workout-plan-schedule-label">{scheduleLabel}</small>
          </header>

          <div className="workout-plan-action">
            {savedProgress?.workout ? (
              <>
                <div className="workout-stats">
                  {savedExercise ? <span>Exercise {savedProgress.exerciseIndex + 1}/{savedTracking.exercises.length} · {savedExercise.sets.filter((set) => set.completed).length}/{savedExercise.sets.length} sets</span> : <span>Round {savedProgress.round}/{savedProgress.workout.rounds}</span>}
                  <span>{Math.floor(savedProgress.elapsed / 60)}m elapsed</span>
                </div>
                <div className="workout-actions"><Button onClick={continueWorkout}>Continue</Button><Button variant="danger" onClick={reset}>Discard</Button></div>
              </>
            ) : workout ? (
              <>
                <div className="workout-stats"><span>{workout.exercises.length} exercises</span><span>{workout.rounds} rounds</span><span>~{duration} min</span></div>
                <Button onClick={() => startWorkout(workout, selectedDate)}>{selectedDate === today ? "Start workout" : "Start this workout"}</Button>
              </>
            ) : (
              <EmptyState compact title="No workout prescribed" description="Browse another day or return to Today." />
            )}
          </div>
        </div>
      </Card>

      {workout ? <ExerciseList workout={workout} /> : null}
      <WorkoutStats />
    </div>
  );
}
