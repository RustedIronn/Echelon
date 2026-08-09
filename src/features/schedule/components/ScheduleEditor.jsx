import { useSchedule } from "@features/schedule/store";
import { useToday } from "@features/schedule/today";
import { Card, Button } from "@components/ui";

export default function ScheduleEditor() {
  const { schedule, updateTask } = useSchedule();

  const { refreshSchedule } = useToday();

  return (
    <Card>
      <div className="section-header">
        <h2>Schedule Editor</h2>

        <p>Customize your daily blocks.</p>
      </div>

      <div className="editor-list">
        {schedule.map((task) => (
          <div className="editor-item" key={task.id}>
            <div>
              <h3>{task.title}</h3>

              <span>{task.category}</span>
            </div>

            <div className="editor-inputs">
              <input
                value={task.start}
                onChange={(e) =>
                  updateTask(task.id, {
                    start: e.target.value,
                  })
                }
              />

              <input
                value={task.end}
                onChange={(e) =>
                  updateTask(task.id, {
                    end: e.target.value,
                  })
                }
              />
            </div>
          </div>
        ))}
      </div>

      <div className="editor-actions">
        <Button onClick={refreshSchedule}>Apply Changes</Button>
      </div>
    </Card>
  );
}
