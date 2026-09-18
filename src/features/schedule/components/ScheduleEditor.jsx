import { useState } from "react";

import { useSchedule } from "@/features/schedule/scheduleStore";
import { useToday } from "@/features/schedule/todayStore";
import { Card, Button } from "@ui";
import {
  createScheduleDraft,
  getScheduleEditorKey,
  prepareScheduleCommit,
  updateScheduleDraft,
} from "../editor";

function ScheduleEditorForm({ schedule, replaceSchedule, refreshSchedule }) {
  const [draft, setDraft] = useState(() => createScheduleDraft(schedule));

  const resetDraft = () => setDraft(createScheduleDraft(schedule));
  const applyDraft = () => {
    const committed = prepareScheduleCommit(draft);
    if (committed && replaceSchedule(committed)) refreshSchedule();
  };

  return (
    <Card>
      <div className="section-header">
        <h2>Schedule Editor</h2>

        <p>Customize your daily blocks.</p>
      </div>

      <div className="stack">
        {draft.map((task) => (
          <div className="editor-item" key={task.id}>
            <div>
              <h3>{task.title}</h3>

              <span>{task.category}</span>
            </div>

            <div className="editor-inputs">
              <input
                type="time"
                aria-label={`Start time for ${task.title}`}
                value={task.start}
                onChange={(e) =>
                  setDraft((current) =>
                    updateScheduleDraft(current, task.id, {
                      start: e.target.value,
                    }),
                  )
                }
              />

              <input
                type="time"
                aria-label={`End time for ${task.title}`}
                value={task.end}
                onChange={(e) =>
                  setDraft((current) =>
                    updateScheduleDraft(current, task.id, {
                      end: e.target.value,
                    }),
                  )
                }
              />
            </div>
          </div>
        ))}
      </div>

      <div className="editor-actions">
        <Button onClick={applyDraft}>Apply Changes</Button>
        <Button onClick={resetDraft}>Cancel</Button>
      </div>
    </Card>
  );
}

export default function ScheduleEditor() {
  const { owner, schedule, revision, updatedAt, replaceSchedule } = useSchedule();
  const { refreshSchedule } = useToday();
  const committedVersion = getScheduleEditorKey({ owner, revision, updatedAt });

  return (
    <ScheduleEditorForm
      key={committedVersion}
      schedule={schedule}
      replaceSchedule={replaceSchedule}
      refreshSchedule={refreshSchedule}
    />
  );
}
