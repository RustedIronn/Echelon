import PlannerWorkspace from "@features/planner/components/PlannerWorkspace";

export default function Planner({ embedded = false, basePath = "/planner" }) {
  return <PlannerWorkspace embedded={embedded} basePath={basePath} />;
}
