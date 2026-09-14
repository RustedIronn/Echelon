import { Button, Card } from "@ui";
import { useWorkout } from "@features/workout/store";
import {
  deriveCurrentExerciseState,
  derivePreviousPerformance,
} from "../tracking";

const formatPreviousSet = (set) =>
  set.weight === null
    ? `${set.reps} reps`
    : `${set.weight} kg × ${set.reps}`;

export default function TrackedWorkoutSession() {
  const {
    workout,
    tracking,
    sessions,
    paused,
    phase,
    seconds,
    exerciseIndex,
    updateTrackedSet,
    completeTrackedSet,
    reopenTrackedSet,
    addTrackedSet,
    removeTrackedSet,
    updateTrackedNotes,
    skipTrackedRest,
    restartTrackedRest,
    continueTrackedWorkout,
    togglePause,
    stopWorkout,
  } = useWorkout();
  const current = deriveCurrentExerciseState(tracking, exerciseIndex);
  const exercise = current.exercise;
  const definition = workout.exercises[exerciseIndex];
  const previous = derivePreviousPerformance(sessions, exercise?.exerciseId);
  const isLastExercise = exerciseIndex === tracking.exercises.length - 1;

  if (!exercise || !definition) return null;

  const continueLabel = current.allSetsComplete
    ? isLastExercise
      ? "Finish Workout"
      : "Next Exercise"
    : "Start Next Set";

  return (
    <Card className="tracked-session-card">
      <div className="tracked-session">
        <header className="tracked-session-header">
          <p className="workout-phase">
            Exercise {exerciseIndex + 1} / {tracking.exercises.length}
          </p>
          <h1>{exercise.name}</h1>
          <p>{definition.description}</p>
        </header>

        <section className="previous-performance" aria-label="Previous performance">
          <h2>Previous performance</h2>
          {previous?.sets.length ? (
            <div className="previous-set-list">
              {previous.sets.map((set) => (
                <span key={set.id}>{formatPreviousSet(set)}</span>
              ))}
            </div>
          ) : (
            <p>No previous set data yet.</p>
          )}
        </section>

        <section className="tracked-sets" aria-labelledby="today-sets-title">
          <div className="tracked-section-heading">
            <h2 id="today-sets-title">Today</h2>
            <Button
              className="tracked-secondary-button"
              onClick={() => addTrackedSet(exercise.exerciseId)}
              disabled={paused}
            >
              Add Set
            </Button>
          </div>

          <div className="tracked-set-list">
            {exercise.sets.map((set, index) => {
              const isCurrent = current.currentSet?.id === set.id;

              return (
                <div
                  className={`tracked-set-row${isCurrent ? " is-current" : ""}`}
                  key={set.id}
                >
                  <strong>Set {index + 1}</strong>

                  <label>
                    <span>Weight (kg)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      value={set.weight ?? ""}
                      disabled={paused || set.completed}
                      onChange={(event) =>
                        updateTrackedSet(
                          exercise.exerciseId,
                          set.id,
                          "weight",
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Reps</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={set.reps ?? ""}
                      disabled={paused || set.completed}
                      onChange={(event) =>
                        updateTrackedSet(
                          exercise.exerciseId,
                          set.id,
                          "reps",
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  {set.completed ? (
                    <Button
                      className="tracked-secondary-button"
                      onClick={() =>
                        reopenTrackedSet(exercise.exerciseId, set.id)
                      }
                      disabled={paused}
                      aria-label={`Reopen set ${index + 1}`}
                    >
                      ✓ Reopen
                    </Button>
                  ) : set.isExtra ? (
                    <Button
                      className="tracked-secondary-button"
                      onClick={() =>
                        removeTrackedSet(exercise.exerciseId, set.id)
                      }
                      disabled={paused}
                      aria-label={`Remove set ${index + 1}`}
                    >
                      Remove
                    </Button>
                  ) : (
                    <span className="tracked-set-status">
                      {isCurrent ? "Current" : "Pending"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {phase === "exercise" && current.currentSet ? (
            <Button
              className="complete-set-button"
              onClick={() =>
                completeTrackedSet(
                  exercise.exerciseId,
                  current.currentSet.id,
                )
              }
              disabled={paused || current.currentSet.reps === null}
            >
              Complete Set
            </Button>
          ) : null}

          {phase === "exercise" && current.currentSet?.reps === null ? (
            <p className="tracked-helper-text">
              Enter reps before completing this set. Weight is optional.
            </p>
          ) : null}
        </section>

        <label className="tracked-notes">
          <span>Exercise note</span>
          <textarea
            rows="2"
            value={exercise.notes}
            disabled={paused}
            placeholder="Optional note for this session"
            onChange={(event) =>
              updateTrackedNotes(exercise.exerciseId, event.target.value)
            }
          />
        </label>

        <section className="tracked-timer" aria-live="polite">
          <span>
            {phase === "prepare"
              ? "Get ready"
              : phase === "rest"
                ? "Rest"
                : "Work"}
          </span>
          <strong>{seconds}</strong>

          {phase === "rest" ? (
            <div className="workout-actions">
              {seconds > 0 ? (
                <Button onClick={skipTrackedRest} disabled={paused}>
                  Skip Rest
                </Button>
              ) : (
                <Button onClick={continueTrackedWorkout} disabled={paused}>
                  {continueLabel}
                </Button>
              )}
              <Button onClick={restartTrackedRest} disabled={paused}>
                Restart Rest
              </Button>
            </div>
          ) : null}
        </section>

        <div className="workout-actions">
          <Button onClick={togglePause}>{paused ? "Resume" : "Pause"}</Button>
          <Button onClick={stopWorkout}>Stop Workout</Button>
        </div>
      </div>
    </Card>
  );
}
