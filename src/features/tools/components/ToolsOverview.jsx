import { Link } from "react-router-dom";

import { Card } from "@ui";
import { firstIncompleteStep } from "../breakdowns.js";
import { useTools } from "../store.js";
import { getNowTask } from "../tasks.js";

const ToolCard = ({ title, detail, link, action }) => (
  <Card className="tools-overview-card">
    <div>
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
    <Link className="tools-text-link" to={link}>{action}</Link>
  </Card>
);

export default function ToolsOverview() {
  const { data, timer } = useTools();
  const now = getNowTask(data.tasks);
  const activeBreakdowns = data.breakdowns.filter(firstIncompleteStep).length;

  return (
    <div className="tools-overview-grid">
      <ToolCard
        title="Now"
        detail={now?.text ?? "Nothing selected. You can choose one thing."}
        link="/tools/now"
        action="Open Now / Next / Later"
      />
      <ToolCard
        title="Brain Dump"
        detail={`${data.brainDump.length} uncategorized ${data.brainDump.length === 1 ? "thought" : "thoughts"}`}
        link="/tools/brain-dump"
        action="Clear some headspace"
      />
      <ToolCard
        title="Task Breakdown"
        detail={`${activeBreakdowns} active ${activeBreakdowns === 1 ? "breakdown" : "breakdowns"}`}
        link="/tools/breakdown"
        action="Make one task smaller"
      />
      <ToolCard
        title="Timer"
        detail={timer.status === "idle" ? "Ready when you are." : `Timer ${timer.status}`}
        link="/tools/timer"
        action="Make time visible"
      />
      <ToolCard
        title="Reset"
        detail="A short, temporary reset checklist."
        link="/tools/reset"
        action="Start a quick reset"
      />
    </div>
  );
}
