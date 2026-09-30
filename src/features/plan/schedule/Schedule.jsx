import { useState } from "react";

import ScheduleEditor from "@features/plan/schedule/components/ScheduleEditor.jsx";
import Timeline from "@features/plan/schedule/components/Timeline.jsx";
import { useSchedule } from "@features/plan/schedule/js/scheduleStore.js";
import { useToday } from "@features/plan/schedule/js/todayStore.js";
import { Button, Drawer, PageTitle, PanelHeader } from "@ui";
import { useFocusSurface } from "@features/focus/js/surface.js";

export default function Schedule({ embedded = false }) {
  const schedule = useSchedule((state) => state.schedule);
  const tasks = useToday((state) => state.tasks);
  const toggleTask = useToday((state) => state.toggleTask);
  const openFocus = useFocusSurface((state) => state.openFor);
  const [editing, setEditing] = useState(false);
  const first = schedule.at(0);
  const last = schedule.at(-1);

  return (
    <div className="page schedule-page">
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

      <Drawer open={editing} onClose={() => setEditing(false)} title="Edit recurring schedule" className="schedule-editor-drawer">
        <ScheduleEditor onClose={() => setEditing(false)} />
      </Drawer>
    </div>
  );
}
