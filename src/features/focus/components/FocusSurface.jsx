import { useEffect, useState } from "react";

import { Drawer } from "@ui";
import { formatDayKey } from "@/shared/date";
import { toFocusMission } from "@features/plan/planner/js/plannerTasks.js";
import { usePlanner } from "@features/plan/planner/js/plannerStore.js";
import { useToday } from "@features/plan/schedule/js/todayStore.js";
import { useFocus } from "../js/store";
import { useFocusSurface } from "../js/surface";
import FocusSession from "./FocusSession";
import AwarenessTimer from "@features/focus/awareness/AwarenessTimer.jsx";

export default function FocusSurface() {
  const { open, mission, close } = useFocusSurface();
  const { task, sessions, tick } = useFocus();
  const scheduleTasks = useToday((state) => state.tasks);
  const plannerTasks = usePlanner((state) => state.document.tasks);
  const [selected, setSelected] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (open) tick();
  }, [open, tick]);

  const options = [
    ...scheduleTasks.filter((item) => !item.done),
    ...plannerTasks.filter((item) => !item.completedAt).map(toFocusMission),
  ];
  const selectedMission = task ?? selected ?? mission;

  return (
    <Drawer open={open} onClose={() => { setSelected(null); close(); }} title="Focus session" className="focus-surface-drawer">
      <div className="focus-surface">
        <FocusSession mission={selectedMission} />
        {!task ? <section className="focus-surface__missions" aria-label="Choose a mission">
          <h3>Work on</h3>
          <div className="focus-surface__mission-list">
            {options.map((item) => <button type="button" key={item.id} className={selectedMission?.id === item.id ? "is-selected" : ""} onClick={() => setSelected(item)}>{item.title}</button>)}
          </div>
        </section> : null}
        <details className="focus-surface__history" open={historyOpen} onToggle={(event) => setHistoryOpen(event.currentTarget.open)}>
          <summary>Recent sessions</summary>
          {sessions.length ? <ul>{sessions.slice(-5).reverse().map((session) => <li key={session.id}><span>{session.task} · {formatDayKey(session.dayKey)}</span><strong>{Math.floor(session.duration / 60)} min</strong></li>)}</ul> : <p>No sessions recorded yet.</p>}
        </details>
        <details className="focus-awareness-tool">
          <summary>Awareness timer</summary>
          <AwarenessTimer compact />
        </details>
      </div>
    </Drawer>
  );
}
