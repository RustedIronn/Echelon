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

          return (
            <Card
              className="workout-detail-card"
              key={session.id ?? `${session.workout}-${session.duration}-${index}`}
            >
              <div className="section-header">
                <h3>{session.workout}</h3>
                <p>{duration ? `${duration} · ` : ""}Completed</p>
              </div>

              {exercises.length ? (
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
