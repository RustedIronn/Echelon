import { Link } from "react-router-dom";

import { Card, EmptyState } from "@ui";
import { useWorkout } from "@features/workout/store";
import {
  formatWorkoutDate,
  formatWorkoutDuration,
  getRecordedExercises,
  sortWorkoutHistory,
} from "../history";

export default function WorkoutHistory() {
  const sessions = useWorkout((state) => state.sessions);
  const history = sortWorkoutHistory(sessions);

  return (
    <div className="stack">
      <div className="section-header">
        <h2>Workout History</h2>
        <p>Your completed sessions, newest first.</p>
      </div>

      {history.length === 0 ? (
        <Card>
          <EmptyState
            title="No completed workouts yet"
            description="Finish a workout and it will appear here."
          />
        </Card>
      ) : (
        <div className="workout-history-list">
          {history.map((session, index) => {
            const exerciseCount = getRecordedExercises(session).length;
            const duration = formatWorkoutDuration(session.duration);

            return (
              <Link
                className="workout-history-link"
                key={session.id ?? `${session.workout}-${session.date}-${session.duration}-${index}`}
                to={`/workouts/history/${session.date}`}
              >
                <Card className="workout-history-card">
                  <div>
                    <strong>{session.workout}</strong>
                    <span>{formatWorkoutDate(session.date)}</span>
                  </div>

                  <div className="workout-history-meta">
                    {duration ? <span>{duration}</span> : null}
                    {exerciseCount ? (
                      <span>
                        {exerciseCount} exercise{exerciseCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    <span>Completed</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
