import { Button, EmptyState } from "@ui";
import { getPrimaryMission } from "@features/focus/missions";

export default function CurrentMission({ tasks, onFocus }) {
  const mission = getPrimaryMission(tasks);

  return (
    <section className="mission-card">
      <div>
        <p>CURRENT MISSION</p>

        {mission ? (
          <>
            <h1>{mission.title}</h1>

            <span>{mission.end ? `${mission.start}–${mission.end}` : mission.start}</span>

            <p>{mission.description}</p>
          </>
        ) : (
          <EmptyState
            title="Day clear"
            description="You finished everything planned."
          />
        )}
      </div>

      {mission && <Button onClick={() => onFocus(mission)}>Open Focus</Button>}
    </section>
  );
}
