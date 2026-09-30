import { useEffect, useState } from "react";
import { useFocus } from "@features/focus/js/store";
import { Button } from "@ui";

export default function FocusSession({ mission }) {
  const { active, task, seconds, tick, start, pause, resume, stop } = useFocus();
  const [completed, setCompleted] = useState(false);
  const selectedMission = task ?? mission;
  const begin = () => {
    setCompleted(false);
    start(selectedMission);
  };
  const finish = () => {
    if (stop()) setCompleted(true);
  };

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [active, tick]);

  const minutes = Math.floor(seconds / 60);

  const secs = seconds % 60;

  return (
    <section className={`focus-card ${active ? "is-active" : task ? "is-paused" : completed ? "is-complete" : "is-ready"}`}>
      <div className="focus-label">
        {active ? "SESSION ACTIVE" : task ? "SESSION PAUSED" : completed ? "SESSION COMPLETE" : "MISSION READY"}
      </div>

      {selectedMission ? (
        <>
          <h2>{selectedMission.title}</h2>
          {!task && selectedMission.description ? (
            <p>{selectedMission.description}</p>
          ) : null}
        </>
      ) : (
        <p>Choose a mission to make this session concrete.</p>
      )}

      <div className="focus-time" aria-label={completed ? "Session complete" : `${minutes} minutes ${secs} seconds`}>
        {completed ? "Done" : `${minutes}:${secs.toString().padStart(2, "0")}`}
      </div>

      <div className="focus-actions">
        {!task && selectedMission ? (
          <Button onClick={begin}>{completed ? "Start Another" : "Start Session"}</Button>
        ) : null}
        {active ? (
          <Button variant="secondary" onClick={pause}>Pause</Button>
        ) : null}
        {task && !active ? <Button onClick={resume}>Resume</Button> : null}
        {task ? (
          <Button variant="secondary" onClick={finish}>Finish Session</Button>
        ) : null}
      </div>
    </section>
  );
}
