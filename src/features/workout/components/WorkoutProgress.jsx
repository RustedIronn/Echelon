import { Link } from "react-router-dom";

import { Card } from "@ui";
import { useWorkout } from "@features/workout/store";
import {
  getTrackedProgressSummary,
  getWeeklyTrackedAggregates,
} from "../insights";
import WorkoutAnalytics from "./WorkoutAnalytics";
import { normalizeCompletedRunnerSummary } from "../runner";
import { formatWorkoutDate, formatWorkoutDuration } from "../history";

const exercisePath = (exerciseId) =>
  `/workouts/progress/exercise/${encodeURIComponent(exerciseId)}`;

const deltaText = (value, label) =>
  `${value > 0 ? "+" : ""}${value} ${label}`;

export default function WorkoutProgress({ embedded = false }) {
  const sessions = useWorkout((state) => state.sessions);
  const summary = getTrackedProgressSummary(sessions);
  const timedRuns = sessions.map((session) => ({ session, runner: normalizeCompletedRunnerSummary(session.runner) }))
    .filter((item) => item.runner)
    .sort((left, right) => right.session.date.localeCompare(left.session.date) || String(right.session.id).localeCompare(String(left.session.id)));
  const weekly = getWeeklyTrackedAggregates(sessions).slice(-8);
  const maxWeeklyVolume = Math.max(
    ...weekly.map((week) => week.weightedVolume),
    1,
  );

  return (
    <div className="stack">
      {!embedded ? <div className="section-header">
        <h2>Workout Progress</h2>
        <p>Overall training history, with set-based insights retained for older tracked sessions.</p>
      </div> : null}

      <div className="workout-progress-section-label">
        <h3>Overall workout history</h3>
        <p>Includes timed runs, legacy sessions, and earlier set-tracked workouts.</p>
      </div>
      <WorkoutAnalytics />

      <section className="runner-progress" aria-label="Timed workout runs">
        <div className="workout-progress-section-label"><h3>Exercise runs</h3><p>Completed timed, hold, duration, and manual workouts.</p></div>
        {timedRuns.length ? <>
          <div className="runner-progress__totals"><span><strong>{timedRuns.length}</strong> sessions</span><span><strong>{timedRuns.reduce((sum, item) => sum + item.runner.completed.length, 0)}</strong> exercises completed</span><span><strong>{timedRuns.reduce((sum, item) => sum + item.runner.skipped.length, 0)}</strong> skipped</span></div>
          <div className="runner-progress__recent">{timedRuns.slice(0, 5).map(({ session, runner }) => <Link key={session.id} to={`/workouts/history/${session.date}`}><strong>{session.workout}</strong><span>{formatWorkoutDate(session.date)} · {runner.roundsCompleted} rounds · {formatWorkoutDuration(session.duration)}</span></Link>)}</div>
        </> : <p>No timed exercise runs recorded yet. Earlier workouts remain in overall history below.</p>}
      </section>

      <details className="legacy-set-progress"><summary>Earlier set-tracked metrics</summary><p>Calculated only from completed v2 set-by-set sessions; new timed runs are counted above.</p>

      {summary.trackedSessions === 0 ? (
        <Card>
          <div className="section-header">
            <h3>No tracked sessions yet</h3>
            <p>
              No earlier set-tracked records were found. Timed runs and legacy workouts still count in overall history.
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
      </details>
    </div>
  );
}
