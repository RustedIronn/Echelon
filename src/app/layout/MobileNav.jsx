import { NavLink } from "react-router-dom";
import { Home, CalendarDays, Timer, CheckSquare, WalletCards } from "lucide-react";

const links = [
  ["Today", "/", Home],
  ["Schedule", "/schedule", CalendarDays],
  ["Focus", "/focus", Timer],
  ["Habits", "/habits", CheckSquare],
  ["Money", "/money", WalletCards],
];

export default function MobileNav() {
  return (
    <nav className="mobile-nav">
      {links.map(([name, path, Icon]) => (
        <NavLink key={name} to={path}>
          <Icon size={22} />

          <span>{name}</span>
        </NavLink>
      ))}
    </nav>
  );
}
