import { useState } from "react";

import { useSchedule } from "@/features/schedule/scheduleStore";
import { useToday } from "@/features/schedule/todayStore";
import { Card, Button } from "@ui";
import { categories } from "../categories";
import { getScheduleItemDuration } from "../time";
import {
  createScheduleDraft,
  getScheduleEditorKey,
  prepareScheduleCommit,
  updateScheduleDraft,
} from "../editor";

function ScheduleEditorForm({ schedule, replaceSchedule, refreshSchedule, onClose }) {
  const [draft, setDraft] = useState(() => createScheduleDraft(schedule));

  const resetDraft = () => {
    setDraft(createScheduleDraft(schedule));
    onClose?.();
  };
  const applyDraft = () => {
    const committed = prepareScheduleCommit(draft);
    if (committed && replaceSchedule(committed)) {
      refreshSchedule();
      onClose?.();
    }
  };

  return (
    <Card>
      <div className="section-header">
        <h2>Edit daily plan</h2>

        <p>Adjust the draft, then apply it once the whole day looks right.</p>
      </div>

      <div className="planner-timeline">
        {draft.map((task) => {
          const category = categories[task.category] ?? categories.foundation;
          const Icon = category.icon;
          const duration = getScheduleItemDuration(task);
          const durationLabel = Number.isFinite(duration) && duration > 0
            ? `${duration}m`
            : "—";
          const visualHeight = Number.isFinite(duration) && duration > 0
            ? Math.min(150, Math.max(86, 72 + duration * .45))
            : 86;

          return (
            <div
              className="planner-block"
              key={task.id}
              style={{
                "--planner-accent": category.color,
                "--planner-tint": category.background,
                "--planner-height": `${visualHeight}px`,
              }}
            >
              <div className="planner-rail" aria-hidden="true">
                <span><Icon size={16} /></span>
              </div>

              <div className="planner-block-surface">
                <div className="planner-block-copy">
                  <span className="planner-category">{category.name}</span>
                  <h3>{task.title}</h3>
                  <p>{task.description}</p>
                </div>

                <div className="planner-time-controls">
                  <label>
                    <span>Start</span>
                    <input
                      type="time"
                      value={task.start}
                      onChange={(event) =>
                        setDraft((current) =>
                          updateScheduleDraft(current, task.id, {
                            start: event.target.value,
                          }),
                        )
                      }
                    />
                  </label>
                  <span className="planner-duration" aria-label={Number.isFinite(duration) ? `${duration} minutes` : "Duration pending"}>
                    {durationLabel}
                  </span>
                  <label>
                    <span>End</span>
                    <input
                      type="time"
                      value={task.end}
                      onChange={(event) =>
                        setDraft((current) =>
                          updateScheduleDraft(current, task.id, {
                            end: event.target.value,
                          }),
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="editor-actions">
        <Button onClick={applyDraft}>Apply Changes</Button>
        <Button variant="secondary" onClick={resetDraft}>Cancel</Button>
      </div>
    </Card>
  );
}

export default function ScheduleEditor({ onClose }) {
  const { owner, schedule, revision, updatedAt, replaceSchedule } = useSchedule();
  const { refreshSchedule } = useToday();
  const committedVersion = getScheduleEditorKey({ owner, revision, updatedAt });

  return (
    <ScheduleEditorForm
      key={committedVersion}
      schedule={schedule}
      replaceSchedule={replaceSchedule}
      refreshSchedule={refreshSchedule}
      onClose={onClose}
    />
  );
}
