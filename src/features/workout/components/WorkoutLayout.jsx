import { Outlet } from "react-router-dom";

import { PageTitle, Stage, Subnav } from "@ui";

const sections = [
  { label: "Today", path: "/workouts/today" },
  { label: "History", path: "/workouts/history" },
  { label: "Plan", path: "/workouts/plans" },
];

export default function WorkoutLayout() {
  return (
    <div className="page workout-app">
      <PageTitle
        tone="ember"
        label="TRAINING"
        title="Workouts"
        description="Train, recover, and review your consistency."
      />

      <Subnav label="Workout sections" items={sections} />

      <Stage tone="ember" className="workout-view workout-stage">
        <Outlet />
      </Stage>
    </div>
  );
}
