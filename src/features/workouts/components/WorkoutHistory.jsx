import { Link, useSearchParams } from "react-router-dom";

import { Card, EmptyState } from "@ui";
import { useWorkout } from "@features/workouts/store";
import {
  formatWorkoutDate,
  formatWorkoutDuration,
  getRecordedExercises,
  sortWorkoutHistory,
} from "../history";
import WorkoutProgress from "./WorkoutProgress";

export default function WorkoutHistory() {
  const sessions = useWorkout((state) => state.sessions);
  const history = sortWorkoutHistory(sessions);
  const [searchParams, setSearchParams] = useSearchParams();
  const view = ["list", "insights"].includes(searchParams.get("view"))
    ? searchParams.get("view")
    : "list";

  const setView = (nextView) => {
    if (nextView === "list") setSearchParams({});
    else setSearchParams({ view: nextView });
  };

  return (
    <div className="stack">
      <div className="section-header">
        <div><h2>Workout History</h2><p>Browse completed sessions and tracked progress.</p></div>
        <div className="workout-history-modes" aria-label="History view">
          {[{ id: "list", label: "Sessions" }, { id: "insights", label: "Insights" }].map((item) => (
            <button type="button" key={item.id} className={view === item.id ? "is-active" : ""} aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}</button>
          ))}
        </div>
      </div>

      {view === "insights" ? <WorkoutProgress embedded /> : history.length === 0 ? (
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
                <Card className="workout-history-card" interactive>
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
