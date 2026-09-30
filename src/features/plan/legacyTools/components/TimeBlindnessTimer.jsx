import { useEffect, useState } from "react";

import { Button, Card, ErrorState } from "@ui";
import { TIMER_DURATIONS } from "../constants.js";
import { useTools } from "../store.js";
import { deriveAwarenessTimer } from "../timer.js";

const clock = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const formatClock = (value) => value ? clock.format(new Date(value)) : "—";
const formatDuration = (milliseconds) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

export default function TimeBlindnessTimer({ compact = false }) {
  const { timer, startTimer, pauseTimer, resumeTimer, finishTimer, resetTimer } = useTools();
  const [duration, setDuration] = useState(25);
  const [custom, setCustom] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState("");
  const derived = deriveAwarenessTimer(timer, now);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (timer.status === "running" && derived.finished) finishTimer(now);
  }, [derived.finished, finishTimer, now, timer.status]);

  const start = () => {
    const minutes = custom === "" ? duration : Number(custom);
    if (startTimer(minutes)) {
      setNow(new Date());
      setError("");
    } else setError("Choose a positive duration in whole minutes.");
  };

  if (compact) return (
    <div className="tools-awareness-compact" aria-live="polite">
      <div className="tools-duration-buttons" aria-label="Quick awareness timer durations">
        {TIMER_DURATIONS.slice(0, 4).map((minutes) => <Button key={minutes} variant={duration === minutes && custom === "" ? "primary" : "secondary"} onClick={() => { setDuration(minutes); setCustom(""); }}>{minutes}m</Button>)}
      </div>
      <label className="tools-custom-duration"><span>Custom minutes</span><input type="number" min="1" step="1" value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Optional" /></label>
      {timer.status !== "idle" ? <div className="tools-timer-grid">
        <div><span>Started</span><strong>{formatClock(timer.startedAt)}</strong></div>
        <div><span>Now</span><strong>{clock.format(now)}</strong></div>
        <div><span>Elapsed</span><strong>{formatDuration(derived.elapsedMs)}</strong></div>
        <div><span>Remaining</span><strong>{formatDuration(derived.remainingMs)}</strong></div>
        <div><span>Target end</span><strong>{formatClock(derived.targetEnd)}</strong></div>
      </div> : null}
      {timer.status === "idle" || timer.status === "finished" ? <Button onClick={start}>Start awareness timer</Button> : (
        <div className="tools-awareness-status">
          <strong>{formatDuration(derived.remainingMs)}</strong>
          <span>{timer.status}</span>
          {timer.status === "running" ? <Button variant="secondary" onClick={() => { pauseTimer(); setNow(new Date()); }}>Pause</Button> : null}
          {timer.status === "paused" ? <Button onClick={() => { resumeTimer(); setNow(new Date()); }}>Resume</Button> : null}
          {timer.status === "running" || timer.status === "paused" ? <Button variant="secondary" onClick={() => { finishTimer(); setNow(new Date()); }}>Finish</Button> : null}
          <Button variant="secondary" onClick={resetTimer}>Clear</Button>
        </div>
      )}
      {error ? <ErrorState compact description={error} /> : null}
    </div>
  );

  return (
    <div className="stack">
      <Card>
        <div className="section-header"><h2>Make elapsed time visible</h2><p>This timer derives from timestamps, so a sleeping tab does not lose time.</p></div>
        <div className="tools-duration-buttons" aria-label="Quick timer durations">
          {TIMER_DURATIONS.map((minutes) => <Button key={minutes} variant={duration === minutes && custom === "" ? "primary" : "secondary"} onClick={() => { setDuration(minutes); setCustom(""); }}>{minutes} min</Button>)}
        </div>
        <label className="tools-custom-duration"><span>Custom minutes</span><input type="number" min="1" step="1" value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Optional" /></label>
        {timer.status === "idle" || timer.status === "finished" ? <Button onClick={start}>Start</Button> : null}
        {error ? <ErrorState compact description={error} /> : null}
      </Card>

      <Card className="tools-timer-card" aria-live="polite">
        <div className="tools-timer-grid">
          <div><span>Started</span><strong>{formatClock(timer.startedAt)}</strong></div>
          <div><span>Now</span><strong>{clock.format(now)}</strong></div>
          <div><span>Elapsed</span><strong>{formatDuration(derived.elapsedMs)}</strong></div>
          <div><span>Remaining</span><strong>{formatDuration(derived.remainingMs)}</strong></div>
          <div><span>Target end</span><strong>{formatClock(derived.targetEnd)}</strong></div>
        </div>
        <p className="tools-timer-status">
          {timer.status === "idle" ? "Ready." : timer.status === "paused" ? "Paused. Time is not accumulating." : timer.status === "finished" ? "Finished. Choose another duration when useful." : "Running."}
        </p>
        <div className="tools-actions">
          {timer.status === "running" ? <Button onClick={() => { pauseTimer(); setNow(new Date()); }}>Pause</Button> : null}
          {timer.status === "paused" ? <Button onClick={() => { resumeTimer(); setNow(new Date()); }}>Resume</Button> : null}
          {timer.status === "running" || timer.status === "paused" ? <Button variant="secondary" onClick={() => { finishTimer(); setNow(new Date()); }}>Finish</Button> : null}
          {timer.status !== "idle" ? <Button variant="secondary" onClick={resetTimer}>Clear timer</Button> : null}
        </div>
      </Card>
    </div>
  );
}
