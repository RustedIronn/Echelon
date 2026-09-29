import { useState } from "react";
import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { useSync } from "@/ui/useSync";

import { useAuth } from "@core/auth/store";
import { logout } from "@core/auth/service";
import { desktopNavigation } from "./navigation";
import { useFocus } from "@features/focus/store";
import { useFocusSurface } from "@features/focus/surface";

const navigationGroups = [
  { label: "Run the day", ids: ["today", "plan", "calendar", "habits"] },
  { label: "Review and manage", ids: ["workouts", "money", "insights", "settings"] },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const { status } = useSync();
  const sessionTask = useFocus((state) => state.task);
  const openFocus = useFocusSurface((state) => state.openFor);

  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="brand">
        <span className="brand-mark">
          <img src="/assets/echelon.svg" alt="" />
        </span>

        <div className="brand-copy">
          <h1>Echelon</h1>

          <p>Personal Growth System</p>
        </div>
        <button className="sidebar-collapse" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"}>
          {collapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        {navigationGroups.map((group) => (
          <div className="sidebar-nav-group" key={group.label}>
            <p className="sidebar-eyebrow">{group.label}</p>
            {group.ids.map((id) => {
              const item = desktopNavigation.find((candidate) => candidate.id === id);
              if (!item) return null;
              const Icon = item.icon;
              return <NavLink key={item.id} to={item.path} end={item.path === "/"} aria-label={item.label} title={item.label}><Icon size={18} /><span>{item.label}</span></NavLink>;
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-dock">
        {sessionTask ? <button type="button" className="sidebar-session-link" onClick={() => openFocus()} title={`Resume focus: ${sessionTask.title}`}>Resume focus · {sessionTask.title}</button> : null}
        <div
          className={`sync-status sync-status--${status}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span aria-hidden="true" />
          <span className="sync-status__label">{status === "syncing"
            ? "Syncing"
            : status === "synced"
              ? "All changes saved"
              : status === "error"
                ? "Sync needs attention"
                : "Local mode"}</span>
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
