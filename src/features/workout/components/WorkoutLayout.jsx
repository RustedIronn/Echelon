import { Outlet } from "react-router-dom";

import { PageTitle, Subnav } from "@ui";

const sections = [
  { label: "Today", path: "/workouts/today" },
  { label: "Calendar", path: "/workouts/calendar" },
  { label: "History", path: "/workouts/history" },
  { label: "Progress", path: "/workouts/progress" },
  { label: "Plans", path: "/workouts/plans" },
];

export default function WorkoutLayout() {
  return (
    <div className="page workout-app">
      <PageTitle
        label="TRAINING"
        title="Workouts"
        description="Train, recover, and review your consistency."
      />

      <Subnav label="Workout sections" items={sections} />

      <div className="workout-view">
        <Outlet />
      </div>
    </div>
  );
}
