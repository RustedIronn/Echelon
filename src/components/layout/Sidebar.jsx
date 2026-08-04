import { NavLink } from "react-router-dom";

import {
  Home,
  CalendarDays,
  Dumbbell,
  Timer,
  CheckSquare,
  BookOpen,
  Settings,
  BarChart3,
} from "lucide-react";

import { useSync } from "@store/useSync";

import { useAuth } from "@store/useAuth";
import { logout } from "@services/auth";

const links = [
  ["Today", "/", Home],
  ["Schedule", "/schedule", CalendarDays],
  ["Focus", "/focus", Timer],
  ["Habits", "/habits", CheckSquare],
  ["Review", "/review", BookOpen],
  ["Settings", "/settings", Settings],
  ["Analytics", "/analytics", BarChart3],
  ["Workouts", "/workouts", Dumbbell],
];

export default function Sidebar() {

  const { user } = useAuth();
  const { syncing, synced } = useSync();
  
  return (
    <aside>
      <div className="brand">
        <img src="/assets/echelon.svg" alt="Echelon" />

        <div>
          <h1>Echelon</h1>

          <p>Personal Growth System</p>
        </div>
      </div>

      <nav>
        {links.map(([name, path, Icon]) => (
          <NavLink key={name} to={path}>
            <Icon size={18} />

            <span>{name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sync-status">
        {syncing ? "☁ Syncing..." : synced ? "✓ Synced" : ""}
      </div>

      {user && (
        <div className="sidebar-user">
          <img src={user.photoURL} alt="" />

          <div className="sidebar-user-info">
            <strong>{user.displayName}</strong>

            <button onClick={logout}>Log Out</button>
          </div>
        </div>
      )}
    </aside>
  );
}
