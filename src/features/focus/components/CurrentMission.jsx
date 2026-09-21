import { Button, EmptyState } from "@ui";

export default function CurrentMission({ mission, onFocus }) {

  return (
    <section className="mission-card">
      <div>
        <p>CURRENT MISSION</p>

        {mission ? (
          <>
            <h1>{mission.title}</h1>

            <span>{mission.source === "planner" ? `Planner · ${mission.priority} priority${mission.start !== "Flexible" ? ` · ${mission.start}` : ""}` : mission.end ? `${mission.start}–${mission.end}` : mission.start}</span>

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
