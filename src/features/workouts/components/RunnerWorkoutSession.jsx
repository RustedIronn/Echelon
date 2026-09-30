import { useState } from "react";

import { Button, Card } from "@ui";
import { formatDayKey } from "@/shared/date";
import { useWorkout } from "../js/store";
import { WORKOUT_RUNNER_VERSION } from "../js/runner";

const clock = (value) => {
  const seconds = Math.max(0, Math.ceil(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
};

export default function RunnerWorkoutSession() {
  const {
    workout, runner, seconds, elapsed, paused, sessions,
    togglePause, completeExercise, skipRunnerExercise, skipRunnerRest,
    setRunnerDifficulty, setRunnerNote, stopWorkout, completeWorkout,
  } = useWorkout();
  const [confirmStop, setConfirmStop] = useState(false);
  const [saveError, setSaveError] = useState(false);
  if (!workout || runner?.version !== WORKOUT_RUNNER_VERSION) return null;

  const exercise = workout.exercises[runner.exerciseIndex];
  const total = workout.rounds * workout.exercises.length;
  const progressed = runner.completed.length + runner.skipped.length;
  const nextIndex = runner.exerciseIndex + 1;
  const next = nextIndex < workout.exercises.length
    ? workout.exercises[nextIndex]
    : runner.round < workout.rounds ? workout.exercises[0] : null;
  const key = `${runner.round}:${exercise.id}`;
  const previous = sessions.filter((session) => session.runner?.version === WORKOUT_RUNNER_VERSION && session.workout === workout.title)
    .sort((left, right) => right.date.localeCompare(left.date) || String(right.id).localeCompare(String(left.id)))[0];
  const phaseLabel = runner.phase === "prepare" ? "GET READY" : runner.phase === "rest" ? "REST" : exercise.mode === "hold" ? "HOLD" : exercise.mode === "duration" ? "DURATION" : exercise.mode === "manual" ? "MANUAL" : "WORK";

  const phaseKey = `${runner.round}:${runner.exerciseIndex}:${runner.phase}`;

  return <Card className={`runner-session runner-session--${runner.phase}`}>
    <header className="runner-session__header">
      <div><span>{runner.phase === "finished" ? "SESSION FINISHED" : `ROUND ${runner.round} / ${workout.rounds}`}</span><h1>{workout.title}</h1></div>
      <strong>{progressed} / {total} exercises</strong>
    </header>
    <div className="runner-session__progress" role="progressbar" aria-label="Workout progress" aria-valuemin="0" aria-valuemax={total} aria-valuenow={progressed}><span style={{ width: `${Math.round((progressed / total) * 100)}%` }} /></div>

    {runner.phase === "finished" ? <section className="runner-session__finish is-complete">
      <h2>Workout complete</h2>
      <p>{runner.completed.length} completed · {runner.skipped.length} skipped · {clock(elapsed)} total</p>
      <label><span>How difficult did it feel? <small>Optional</small></span><select value={runner.difficulty ?? ""} onChange={(event) => setRunnerDifficulty(event.target.value === "" ? null : Number(event.target.value))}><option value="">Not set</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>
      <label><span>Session note <small>Optional</small></span><textarea rows="3" maxLength="1000" value={runner.note} onChange={(event) => setRunnerNote(event.target.value)} placeholder="What do you want to remember?" /></label>
      {saveError ? <p role="alert">The session could not be saved. It remains here so you can try again.</p> : null}
      <Button onClick={() => { if (!completeWorkout()) setSaveError(true); }}>Save session</Button>
    </section> : <>
      <section key={phaseKey} className="runner-session__current workout-phase-enter" aria-label="Current exercise">
        <span>EXERCISE {runner.exerciseIndex + 1} OF {workout.exercises.length}</span>
        <h2>{exercise.name}</h2>
        {exercise.instructions ? <p>{exercise.instructions}</p> : null}
        <div className="runner-session__clock"><small aria-live="polite">{paused ? "PAUSED" : phaseLabel}</small><strong aria-live="off">{exercise.mode === "manual" && runner.phase === "work" ? clock(elapsed) : clock(seconds)}</strong></div>
        <div className="runner-session__controls">
          <Button onClick={togglePause}>{paused ? "Resume" : "Pause"}</Button>
          {runner.phase === "rest" ? <Button variant="secondary" disabled={paused} onClick={() => skipRunnerRest(key)}>Skip rest</Button> : runner.phase === "prepare" ? null : <>
            <Button variant="secondary" disabled={paused} onClick={() => completeExercise(key)}>{exercise.mode === "manual" ? "Mark complete" : "Complete now"}</Button>
            <Button variant="tertiary" disabled={paused} onClick={() => skipRunnerExercise(key)}>Skip exercise</Button>
          </>}
        </div>
      </section>
      <div className="runner-session__context"><span>Elapsed {clock(elapsed)}</span><span>{next ? `Next: ${next.name}${nextIndex >= workout.exercises.length ? " · next round" : ""}` : "Final exercise"}</span></div>
      {previous ? <p className="runner-session__previous">Last time · {formatDayKey(previous.date)} · {previous.runner.roundsCompleted} rounds · {clock(previous.duration)}{previous.runner.difficulty ? ` · difficulty ${previous.runner.difficulty}/5` : ""}</p> : null}
      <div className="runner-session__exit">
        {confirmStop ? <><p>Pause and leave? Your place will be saved to continue later.</p><Button variant="secondary" onClick={() => { stopWorkout(); setConfirmStop(false); }}>Stop and save for later</Button><Button variant="tertiary" onClick={() => setConfirmStop(false)}>Keep going</Button></> : <Button variant="tertiary" onClick={() => setConfirmStop(true)}>Stop workout</Button>}
      </div>
    </>}
  </Card>;
}
