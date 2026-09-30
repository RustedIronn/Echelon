import { Link, useParams } from "react-router-dom";

import { Card, EmptyState } from "@ui";
import { useWorkout } from "@features/workouts/store";
import { formatWorkoutDate } from "../history";
import {
  compareLatestExerciseSessions,
  computeExercisePRs,
  getExercisePerformance,
} from "../insights";

const formatSet = (set) =>
  set.weight === null
    ? `${set.reps} reps`
    : `${set.weight} kg × ${set.reps}`;

const signed = (value, suffix) =>
  `${value > 0 ? "+" : ""}${value} ${suffix}`;

const PR_ITEMS = [
  ["heaviestWeight", "Heaviest weight", (pr) => `${pr.value} kg`],
  ["mostReps", "Most reps in one set", (pr) => `${pr.value} reps`],
  ["bestSetVolume", "Best set volume", (pr) => `${pr.value} kg`],
  ["bestSessionVolume", "Best session volume", (pr) => `${pr.value} kg`],
];

export default function WorkoutExerciseProgress() {
  const { exerciseId } = useParams();
  const sessions = useWorkout((state) => state.sessions);
  const performance = getExercisePerformance(sessions, exerciseId);

  if (!performance) {
    return (
      <div className="stack">
        <div className="workout-detail-header">
          <div className="section-header">
            <h2>Exercise history</h2>
            <p>No completed tracked sets were found for this exercise.</p>
          </div>
          <Link className="workout-text-link" to="/workouts/progress">
            Back to progress
          </Link>
        </div>
        <Card>
          <EmptyState
            title="No tracked history yet"
            description="Complete this exercise in a tracked workout to see performance and records here."
          />
        </Card>
      </div>
    );
  }

  const { occurrences } = performance;
  const latest = occurrences[0];
  const comparison = compareLatestExerciseSessions(occurrences);
  const prs = computeExercisePRs(occurrences);

  return (
    <div className="stack">
      <div className="workout-detail-header">
        <div className="section-header">
          <h2>{performance.name}</h2>
          <p>
            {occurrences.length} tracked session
            {occurrences.length === 1 ? "" : "s"}, newest first.
          </p>
        </div>
        <Link className="workout-text-link" to="/workouts/progress">
          Back to progress
        </Link>
      </div>

      <Card>
        <div className="section-header">
          <h3>Latest performance</h3>
          <p>{formatWorkoutDate(latest.date)}</p>
        </div>
        <div className="exercise-performance-sets">
          {latest.sets.map((set) => (
            <span key={set.id}>{formatSet(set)}</span>
          ))}
        </div>
        {comparison ? (
          <div className="exercise-comparison">
            <p>
              Previous: {comparison.previous.sets.map(formatSet).join(", ")}
            </p>
            <div className="exercise-comparison-deltas">
              <span>{signed(comparison.totalRepsDelta, "total reps")}</span>
              <span>
                {signed(comparison.weightedVolumeDelta, "kg volume")}
              </span>
            </div>
          </div>
        ) : (
          <p className="workout-detail-note">
            Complete this exercise again to compare sessions.
          </p>
        )}
      </Card>

      <Card>
        <div className="section-header">
          <h3>Personal records</h3>
          <p>Derived from completed tracked sets only.</p>
        </div>
        <div className="exercise-pr-grid">
          {PR_ITEMS.map(([key, label, format]) => {
            const pr = prs[key];
            return (
              <div key={key}>
                <span>{label}</span>
                <strong>{pr ? format(pr) : "—"}</strong>
                {pr ? <small>{formatWorkoutDate(pr.date)}</small> : null}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="section-header">
        <h3>Session history</h3>
        <p>Only workouts with completed v2 set data appear here.</p>
      </div>

      <div className="exercise-history-list">
        {occurrences.map((occurrence) => (
          <Card
            className="exercise-history-card"
            key={`${occurrence.sessionId ?? occurrence.startedAt}-${occurrence.exerciseId}`}
          >
            <div className="exercise-history-heading">
              <div>
                <strong>{formatWorkoutDate(occurrence.date)}</strong>
                <span>{occurrence.workout}</span>
              </div>
              <Link
                className="workout-text-link"
                to={`/workouts/history/${occurrence.date}`}
              >
                Workout details
              </Link>
            </div>
            <div className="exercise-performance-sets">
              {occurrence.sets.map((set) => (
                <span key={set.id}>{formatSet(set)}</span>
              ))}
            </div>
            <p className="workout-detail-note">
              {occurrence.totalSets} sets · {occurrence.totalReps} reps
              {occurrence.hasWeightedSets
                ? ` · ${occurrence.weightedVolume} kg volume`
                : ""}
            </p>
            {occurrence.notes ? (
              <p className="tracked-history-note">{occurrence.notes}</p>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
