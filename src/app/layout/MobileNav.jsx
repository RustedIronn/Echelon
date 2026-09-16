import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Dumbbell,
  Home,
  Menu,
  Settings,
  Timer,
  WalletCards,
  Wrench,
} from "lucide-react";

const links = [
  ["Today", "/", Home],
  ["Schedule", "/schedule", CalendarDays],
  ["Focus", "/focus", Timer],
  ["Habits", "/habits", CheckSquare],
];

const moreLinks = [
  ["Tools", "/tools", Wrench],
  ["Money", "/money", WalletCards],
  ["Workouts", "/workouts", Dumbbell],
  ["Review", "/review", BookOpen],
  ["Analytics", "/analytics", BarChart3],
  ["Settings", "/settings", Settings],
];

export default function MobileNav() {
  const [openPath, setOpenPath] = useState(null);
  const location = useLocation();
  const open = openPath === location.pathname;
  const moreActive = moreLinks.some(([, path]) => location.pathname.startsWith(path));

  return (
    <nav className="mobile-nav">
      {links.map(([name, path, Icon]) => (
        <NavLink key={name} to={path}>
          <Icon size={22} />

          <span>{name}</span>
        </NavLink>
      ))}
      <div className="mobile-more">
        <button
          type="button"
          className={moreActive ? "active" : ""}
          aria-expanded={open}
          aria-controls="mobile-more-menu"
          onClick={() => setOpenPath(open ? null : location.pathname)}
        >
          <Menu size={22} />
          <span>More</span>
        </button>
        {open ? (
          <div className="mobile-more-menu" id="mobile-more-menu">
            {moreLinks.map(([name, path, Icon]) => (
              <NavLink key={name} to={path} onClick={() => setOpenPath(null)}>
                <Icon size={18} />
                <span>{name}</span>
              </NavLink>
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
