import { NavLink } from "react-router-dom";

import { useSync } from "@/ui/useSync";

import { useAuth } from "@core/auth/store";
import { logout } from "@core/auth/service";
import { desktopNavigation } from "./navigation";

const navigationGroups = [
  { label: "Run the day", ids: ["today", "plan", "focus", "habits"] },
  { label: "Review and manage", ids: ["workouts", "money", "insights", "settings"] },
];

export default function Sidebar() {
  const { user } = useAuth();
  const { status } = useSync();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <img src="/assets/echelon.svg" alt="" />
        </span>

        <div>
          <h1>Echelon</h1>

          <p>Personal Growth System</p>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        {navigationGroups.map((group) => (
          <div className="sidebar-nav-group" key={group.label}>
            <p className="sidebar-eyebrow">{group.label}</p>
            {group.ids.map((id) => {
              const item = desktopNavigation.find((candidate) => candidate.id === id);
              if (!item) return null;
              const Icon = item.icon;
              return <NavLink key={item.id} to={item.path} end={item.path === "/"}><Icon size={18} /><span>{item.label}</span></NavLink>;
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-dock">
        <div
          className={`sync-status sync-status--${status}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span aria-hidden="true" />
          {status === "syncing"
            ? "Syncing"
            : status === "synced"
              ? "All changes saved"
              : status === "error"
                ? "Sync needs attention"
                : "Local mode"}
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
      </div>
    </aside>
  );
}
