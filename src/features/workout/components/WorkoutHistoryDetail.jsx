import { Link, useParams } from "react-router-dom";

import { Card, EmptyState } from "@ui";
import { useWorkout } from "@features/workout/store";
import {
  formatWorkoutDate,
  formatWorkoutDuration,
  getAdjacentWorkoutDates,
  getRecordedExercises,
  groupWorkoutHistoryByDate,
} from "../history";
import {
  getTrackingMetrics,
  normalizeCompletedTracking,
} from "../tracking";

export default function WorkoutHistoryDetail() {
  const { date } = useParams();
  const sessions = useWorkout((state) => state.sessions);
  const historyByDate = groupWorkoutHistoryByDate(sessions);
  const daySessions = historyByDate[date] ?? [];
  const adjacent = getAdjacentWorkoutDates(sessions, date);

  return (
    <div className="stack">
      <div className="workout-detail-header">
        <div className="section-header">
          <h2>{daySessions.length ? formatWorkoutDate(date) : "Workout not found"}</h2>
          <p>
            {daySessions.length
              ? `${daySessions.length} completed session${daySessions.length === 1 ? "" : "s"}`
              : "There is no recorded workout for this date."}
          </p>
        </div>
        <Link className="workout-text-link" to="/workouts/history">
          Back to history
        </Link>
      </div>

      {daySessions.length === 0 ? (
        <Card>
          <EmptyState
            title="No workout recorded"
            description="Choose a completed date from the calendar or history."
          />
        </Card>
      ) : (
        daySessions.map((session, index) => {
          const exercises = getRecordedExercises(session);
          const duration = formatWorkoutDuration(session.duration);
          const tracking = normalizeCompletedTracking(session.tracking);
          const metrics = getTrackingMetrics(tracking);

          return (
            <Card
              className="workout-detail-card"
              key={session.id ?? `${session.workout}-${session.duration}-${index}`}
            >
              <div className="section-header">
                <h3>{session.workout}</h3>
                <p>{duration ? `${duration} · ` : ""}Completed</p>
              </div>

              {tracking ? (
                <div className="tracked-history">
                  <div className="tracked-history-summary">
                    <span>{metrics.totalSets} sets</span>
                    <span>{metrics.totalReps} reps</span>
                    {metrics.totalVolume > 0 ? (
                      <span>{metrics.totalVolume} kg volume</span>
                    ) : null}
                  </div>

                  {tracking.exercises.map((exercise) => {
                    const completedSets = exercise.sets.filter(
                      (set) => set.completed,
                    );

                    return (
                      <section
                        className="tracked-history-exercise"
                        key={exercise.exerciseId}
                      >
                        <h4>
                          <Link
                            className="workout-text-link"
                            to={`/workouts/progress/exercise/${encodeURIComponent(exercise.exerciseId)}`}
                          >
                            {exercise.name}
                          </Link>
                        </h4>
                        {exercise.notes ? (
                          <p className="tracked-history-note">{exercise.notes}</p>
                        ) : null}
                        {completedSets.length ? (
                          <ol className="tracked-history-sets">
                            {completedSets.map((set, setIndex) => (
                              <li key={set.id}>
                                <span>Set {setIndex + 1}</span>
                                <strong>
                                  {set.weight === null
                                    ? `${set.reps} reps`
                                    : `${set.weight} kg × ${set.reps}`}
                                </strong>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="workout-detail-note">
                            No completed set data was recorded.
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              ) : exercises.length ? (
                <div>
                  <h4>Exercises</h4>
                  <ol className="workout-detail-exercises">
                    {exercises.map((exercise, exerciseIndex) => (
                      <li key={`${exercise}-${exerciseIndex}`}>{exercise}</li>
                    ))}
                  </ol>
                </div>
              ) : (
                <p className="workout-detail-note">
                  Exercise details were not recorded for this session.
                </p>
              )}
            </Card>
          );
        })
      )}

      <nav className="workout-detail-nav" aria-label="Workout history navigation">
        {adjacent.previous ? (
          <Link to={`/workouts/history/${adjacent.previous}`}>
            ← Previous workout
          </Link>
        ) : (
          <span />
        )}

        <Link to="/workouts/today">Today</Link>

        {adjacent.next ? (
          <Link to={`/workouts/history/${adjacent.next}`}>Next workout →</Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
