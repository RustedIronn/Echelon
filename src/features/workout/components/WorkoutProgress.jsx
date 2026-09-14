import { Link } from "react-router-dom";

import { Card } from "@ui";
import { useWorkout } from "@features/workout/store";
import {
  getTrackedProgressSummary,
  getWeeklyTrackedAggregates,
} from "../insights";
import WorkoutAnalytics from "./WorkoutAnalytics";

const exercisePath = (exerciseId) =>
  `/workouts/progress/exercise/${encodeURIComponent(exerciseId)}`;

const deltaText = (value, label) =>
  `${value > 0 ? "+" : ""}${value} ${label}`;

export default function WorkoutProgress() {
  const sessions = useWorkout((state) => state.sessions);
  const summary = getTrackedProgressSummary(sessions);
  const weekly = getWeeklyTrackedAggregates(sessions).slice(-8);
  const maxWeeklyVolume = Math.max(
    ...weekly.map((week) => week.weightedVolume),
    1,
  );

  return (
    <div className="stack">
      <div className="section-header">
        <h2>Workout Progress</h2>
        <p>Overall history and completed tracked-session insights.</p>
      </div>

      <div className="workout-progress-section-label">
        <h3>Overall workout history</h3>
        <p>Includes legacy and tracked sessions.</p>
      </div>
      <WorkoutAnalytics />

      <div className="workout-progress-section-label">
        <h3>Tracked v2 metrics</h3>
        <p>Calculated only from completed set-by-set sessions.</p>
      </div>

      {summary.trackedSessions === 0 ? (
        <Card>
          <div className="section-header">
            <h3>No tracked sessions yet</h3>
            <p>
              Legacy workouts still count above. Complete a new tracked workout
              to unlock set, volume, and exercise insights.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="tracked-metric-grid">
              <div>
                <strong>{summary.trackedSessions}</strong>
                <span>Tracked sessions</span>
              </div>
              <div>
                <strong>{summary.totalSets}</strong>
                <span>Total sets</span>
              </div>
              <div>
                <strong>{summary.totalReps}</strong>
                <span>Total reps</span>
              </div>
              <div>
                <strong>{summary.weightedVolume}</strong>
                <span>Weighted volume (kg)</span>
              </div>
              <div>
                <strong>{summary.workoutsThisWeek}</strong>
                <span>This week</span>
              </div>
              <div>
                <strong>{summary.workoutsThisMonth}</strong>
                <span>This month</span>
              </div>
            </div>
          </Card>

          <div className="workout-insight-grid">
            <Card>
              <div className="section-header">
                <h3>Most trained exercises</h3>
                <p>Tracked session appearances.</p>
              </div>
              <div className="workout-ranked-list">
                {summary.mostTrained.slice(0, 5).map((exercise) => (
                  <Link
                    key={exercise.exerciseId}
                    to={exercisePath(exercise.exerciseId)}
                  >
                    <span>{exercise.name}</span>
                    <strong>{exercise.sessions}</strong>
                  </Link>
                ))}
              </div>
            </Card>

            <Card>
              <div className="section-header">
                <h3>Recent improvements</h3>
                <p>Latest session compared with the prior one.</p>
              </div>
              {summary.recentImprovements.length ? (
                <div className="workout-ranked-list">
                  {summary.recentImprovements.slice(0, 5).map((exercise) => (
                    <Link
                      key={exercise.exerciseId}
                      to={exercisePath(exercise.exerciseId)}
                    >
                      <span>
                        {exercise.name}
                        <small>
                          {deltaText(
                            exercise.comparison.totalRepsDelta,
                            "reps",
                          )} · {" "}
                          {deltaText(
                            exercise.comparison.weightedVolumeDelta,
                            "kg",
                          )}
                        </small>
                      </span>
                      <strong>View</strong>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="workout-detail-note">
                  Two comparable sessions are needed. Mixed signals are not
                  labelled as improvement.
                </p>
              )}
            </Card>
          </div>

          <Card>
            <div className="section-header">
              <h3>Weekly tracked work</h3>
              <p>Workout frequency and weighted volume by local week.</p>
            </div>
            <div className="workout-weekly-list">
              {weekly.map((week) => (
                <div className="workout-weekly-row" key={week.week}>
                  <span>Week of {week.week}</span>
                  <div className="workout-weekly-bar" aria-hidden="true">
                    <i
                      style={{
                        width: `${(week.weightedVolume / maxWeeklyVolume) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {week.workouts} workout{week.workouts === 1 ? "" : "s"} · {" "}
                    {week.weightedVolume} kg
                  </strong>
                </div>
              ))}
            </div>
            {weekly.length === 1 ? (
              <p className="workout-detail-note">
                One tracked week is shown as a total, not a trend.
              </p>
            ) : null}
          </Card>
        </>
      )}
    </div>
  );
}
