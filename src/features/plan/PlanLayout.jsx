import { Outlet } from "react-router-dom";

import { PageTitle, Stage, Subnav } from "@ui";

const sections = [
  { label: "Schedule", path: "/plan/schedule" },
  { label: "Planner", path: "/plan/planner" },
  { label: "Notes", path: "/plan/notes" },
];

export default function PlanLayout() {
  return (
    <div className="page plan-app">
      <PageTitle tone="planner" label="PLAN THE DAY" title="Plan" description="Recurring structure, one-off work, and thoughts worth keeping." />
      <Subnav label="Plan modes" items={sections} />
      <Stage tone="soft" className="plan-stage"><Outlet /></Stage>
    </div>
  );
}
