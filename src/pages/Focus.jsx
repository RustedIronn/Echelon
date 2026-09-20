import { useState } from "react";
import { useLocation } from "react-router-dom";

import FocusSession from "@features/focus/components/FocusSession";
import MissionSelector from "@features/focus/components/MissionSelector";
import { getPrimaryMission } from "@features/focus/missions";
import { useFocus } from "@features/focus/store";
import { useToday } from "@features/schedule/todayStore";
import { formatDayKey } from "@/shared/date";
import { PageTitle, Card, EmptyState, PanelHeader, Stage } from "@ui";
import TimeBlindnessTimer from "@features/tools/components/TimeBlindnessTimer";

export default function Focus() {
  const location = useLocation();
  const tasks = useToday((state) => state.tasks);
  const { task, sessions } = useFocus();
  const requestedScheduleMission = tasks.find(
    (candidate) => candidate.id === location.state?.missionId && !candidate.done,
  );
  const requestedExternalMission = location.state?.mission ?? null;
  const requestedMission = requestedExternalMission ?? requestedScheduleMission;
  const missionOptions = requestedExternalMission
    ? [requestedExternalMission, ...tasks]
    : tasks;
  const defaultMission = requestedMission ?? getPrimaryMission(tasks);
  const [selectedId, setSelectedId] = useState(defaultMission?.id ?? null);
  const selectedMission = missionOptions.find(
    (candidate) => candidate.id === selectedId && !candidate.done,
  ) ?? defaultMission;

  return (
    <div className="page">
      <PageTitle
        tone="focus"
        label="DEEP WORK"
        title="Focus"
        description="Choose one mission, then protect the session."
      />

      <div className="focus-workspace">
        <Stage tone="focus" className="focus-mode-shell">
          <FocusSession mission={selectedMission} />
          {!task ? (
            <MissionSelector compact tasks={missionOptions} selectedId={selectedMission?.id ?? null} onSelect={setSelectedId} />
          ) : null}
        </Stage>

        <Card material="soft" shape="slab" className="focus-history-panel">
          <PanelHeader eyebrow="Log" title="Recent sessions" description="The last five completed focus sessions." />
          {sessions.length ? (
            <div className="focus-session-list">
              {sessions.slice(-5).reverse().map((session) => (
                <div className="session-item" key={session.id}>
                  <div><strong>{session.task}</strong><small>{formatDayKey(session.dayKey)}</small></div>
                  <span>{Math.floor(session.duration / 60)} min</span>
                </div>
              ))}
            </div>
          ) : <EmptyState compact title="No focus sessions yet" description="Choose a mission when you are ready." />}
          <details className="focus-awareness-tool">
            <summary>Awareness timer</summary>
            <TimeBlindnessTimer compact />
          </details>
        </Card>
      </div>
    </div>
  );
}
