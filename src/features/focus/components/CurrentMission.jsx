import { getCurrentTask } from "@utils/time";
import { useFocus } from "@features/focus/store";
import { Button, EmptyState } from "@components/ui";

export default function CurrentMission({ tasks }) {
  const { start } = useFocus();

  const current = getCurrentTask(tasks);

  const mission = current || tasks.find((task) => !task.done);

  return (
    <section className="mission-card">
      <div>
        <p>CURRENT MISSION</p>

        {mission ? (
          <>
            <h1>{mission.title}</h1>

            <span>
              {mission.start}-{mission.end}
            </span>

            <p>{mission.description}</p>
          </>
        ) : (
          <EmptyState
            title="Day Complete 🎉"
            description="You finished everything planned."
          />
        )}
      </div>

      {mission && <Button onClick={() => start(mission)}>Start Focus</Button>}
    </section>
  );
}
