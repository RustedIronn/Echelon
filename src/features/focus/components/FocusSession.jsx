import { useEffect } from "react";
import { useFocus } from "@features/focus/store";
import { Button } from "@ui";

export default function FocusSession() {
  const { active, task, seconds, tick, start, stop } = useFocus();

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [active]);

  const minutes = Math.floor(seconds / 60);

  const secs = seconds % 60;

  return (
    <section className="focus-card">
      <div className="focus-label">DEEP WORK</div>

      <div className="focus-time">
        {minutes}:{secs.toString().padStart(2, "0")}
      </div>

      {task ? <h2>{task.title}</h2> : <p>Choose a mission and begin.</p>}

      {active ? <Button onClick={stop}>Finish Session</Button> : null}
    </section>
  );
}
