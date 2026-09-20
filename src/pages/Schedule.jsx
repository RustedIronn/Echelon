import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useSchedule } from "@features/schedule/scheduleStore";
import { useToday } from "@features/schedule/todayStore";
import ScheduleEditor from "@features/schedule/components/ScheduleEditor";
import Timeline from "@features/schedule/components/Timeline";
import { Button, PageTitle, PanelHeader } from "@ui";

export default function Schedule({ embedded = false }) {
  const schedule = useSchedule((state) => state.schedule);
  const tasks = useToday((state) => state.tasks);
  const toggleTask = useToday((state) => state.toggleTask);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const first = schedule.at(0);
  const last = schedule.at(-1);
  const openFocus = (mission) => {
    navigate("/focus", { state: { missionId: mission.id } });
  };

  useEffect(() => {
    if (!editing) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setEditing(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [editing]);

  return (
    <div className="page">
      {!embedded ? <PageTitle
        tone="planner"
        label="PLANNER"
        title="Schedule"
        description="Shape the plan before you execute it."
      /> : null}

      <section className="planner-day">
        <PanelHeader
          eyebrow="Recurring timetable"
          title="Move through the plan"
          description="Complete activities here. Open the structure editor only when the routine needs to change."
          actions={(
            <div className="schedule-heading-actions">
              <dl className="schedule-overview" aria-label="Schedule summary">
                <div><dt>Blocks</dt><dd>{schedule.length}</dd></div>
                {first && last ? <div><dt>Span</dt><dd>{first.start}–{last.end}</dd></div> : null}
              </dl>
              <Button variant="secondary" onClick={() => setEditing(true)}>Edit structure</Button>
            </div>
          )}
        />

        <Timeline tasks={tasks} toggleTask={toggleTask} onFocus={openFocus} />
      </section>

      {editing ? <div className="planner-editor-overlay" role="dialog" aria-modal="true" aria-label="Edit recurring schedule" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(false); }}>
        <div className="planner-editor-content"><ScheduleEditor onClose={() => setEditing(false)} /></div>
      </div> : null}
    </div>
  );
}
