import { NavLink } from "react-router-dom";

import { useSync } from "@/ui/useSync";

import { useAuth } from "@core/auth/store";
import { logout } from "@core/auth/service";
import { desktopNavigation } from "./navigation";

export default function Sidebar() {
  const { user } = useAuth();
  const { status } = useSync();

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
        {desktopNavigation.map(({ id, label, path, icon: Icon }) => (
          <NavLink key={id} to={path}>
            <Icon size={18} />

            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sync-status">
        {status === "syncing"
          ? "☁ Syncing..."
          : status === "synced"
            ? "✓ Synced"
            : status === "error"
              ? "⚠ Sync failed"
              : ""}
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
