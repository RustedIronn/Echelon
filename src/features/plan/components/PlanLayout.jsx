import { Outlet } from "react-router-dom";

import { PageTitle, Stage, Subnav } from "@ui";

const sections = [
  { label: "Schedule", path: "/plan/schedule" },
  { label: "Planner", path: "/plan/planner" },
];

export default function PlanLayout() {
  return (
    <div className="page plan-app">
      <PageTitle tone="planner" label="PLAN THE DAY" title="Plan" description="Recurring structure and one-off work, kept distinct." />
      <Subnav label="Plan modes" items={sections} />
      <Stage tone="soft" className="plan-stage"><Outlet /></Stage>
    </div>
  );
}
