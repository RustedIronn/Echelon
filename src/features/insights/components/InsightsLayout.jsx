import { Outlet } from "react-router-dom";

import { PageTitle, Stage, Subnav } from "@ui";
import { useComposure } from "@features/insights/review/composureStore.js";

const sections = [
  { label: "Overview", path: "/insights", end: true },
  { label: "Daily Review", path: "/insights/daily" },
  { label: "Composure", path: "/insights/composure" },
  { label: "Analysis", path: "/insights/analysis" },
];

export default function InsightsLayout() {
  const owner = useComposure((state) => state.owner);

  return (
    <div className="page insights-wing">
      <PageTitle
        tone="reflection"
        label="LOOK BACK · MOVE FORWARD"
        title="Insights"
        description="Reflection and patterns, gathered in one quiet place."
      />

      <Subnav label="Insights sections" items={sections} />

      <Stage tone="reflection" className="insights-stage">
        <Outlet key={owner ?? "anonymous"} />
      </Stage>
    </div>
  );
}
