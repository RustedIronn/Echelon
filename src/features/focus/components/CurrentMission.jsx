import { useEffect, useState } from "react";

import { Button, EmptyState } from "@ui";
import { getScheduleMinutes } from "@features/plan/schedule/js/scheduleTime.js";

export default function CurrentMission({ mission, onFocus }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const progress = mission?.source !== "planner" && mission?.end
    ? Math.min(100, Math.max(0, (
        (now.getHours() * 60 + now.getMinutes() - getScheduleMinutes(mission.start)) /
        Math.max(1, getScheduleMinutes(mission.end) - getScheduleMinutes(mission.start))
      ) * 100))
    : null;

  return (
    <section className="mission-card">
      <div>
        <p>CURRENT MISSION</p>

        {mission ? (
          <>
            <h1>{mission.title}</h1>

            <span>{mission.source === "planner" ? `Planner · ${mission.priority} priority${mission.start !== "Flexible" ? ` · ${mission.start}` : ""}` : mission.end ? `${mission.start}–${mission.end}` : mission.start}</span>

            <p>{mission.description}</p>

            {progress !== null ? (
              <div
                className="mission-card__progress"
                role="progressbar"
                aria-label={`Time progress for ${mission.title}`}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={Math.round(progress)}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
            ) : null}
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
