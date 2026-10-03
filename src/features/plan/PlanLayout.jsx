import { Outlet } from "react-router-dom";

import { Subnav } from "@ui";

const sections = [
  { label: "Schedule", path: "/plan/schedule" },
  { label: "Planner", path: "/plan/planner" },
  { label: "Notes", path: "/plan/notes" },
];

export default function PlanLayout() {
  return (
    <div className="page plan-app">
      <header className="plan-command-header">
        <div><span>Plan</span><h1>Make room for what matters.</h1></div>
        <Subnav label="Plan modes" items={sections} />
      </header>
      <main className="plan-workbench"><Outlet /></main>
    </div>
  );
}
