import { useNavigate } from "react-router-dom";

import { useToday } from "@/features/schedule/todayStore";
import { PageTitle, Stage } from "@ui";
import CurrentMission from "@/features/focus/components/CurrentMission";
import NextUp from "@/features/dashboard/components/NextUp";
import TodaySummaries from "@/features/dashboard/components/TodaySummaries";

export default function Today() {
  const { tasks, toggleTask } = useToday();
  const navigate = useNavigate();
  const openFocus = (mission) => {
    navigate("/focus", { state: mission.source ? { mission } : { missionId: mission.id } });
  };

  return (
    <div className="page today-page">
      <PageTitle
        tone="command"
        label="DAILY SYSTEM"
        title="Today"
        description="What matters right now, and what comes next."
      />

      <Stage tone="command" className="today-stage">
        <CurrentMission tasks={tasks} onFocus={openFocus} />

        <NextUp tasks={tasks} onFocus={openFocus} onToggle={toggleTask} limit={2} />
        <TodaySummaries />
      </Stage>
    </div>
  );
}
