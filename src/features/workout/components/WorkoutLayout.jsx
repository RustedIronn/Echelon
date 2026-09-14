import { NavLink, Outlet } from "react-router-dom";

import { PageTitle } from "@ui";

const sections = [
  ["Today", "/workouts/today"],
  ["Calendar", "/workouts/calendar"],
  ["History", "/workouts/history"],
  ["Progress", "/workouts/progress"],
  ["Plans", "/workouts/plans"],
];

export default function WorkoutLayout() {
  return (
    <div className="page workout-app">
      <PageTitle
        label="TRAINING"
        title="Workouts"
        description="Train, recover, and review your consistency."
      />

      <nav className="workout-subnav" aria-label="Workout sections">
        {sections.map(([label, path]) => (
          <NavLink key={path} to={path}>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="workout-view">
        <Outlet />
      </div>
    </div>
  );
}
