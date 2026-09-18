import { NavLink } from "react-router-dom";

export default function Subnav({ label, items }) {
  return (
    <nav className="subnav" aria-label={label}>
      {items.map(({ label: itemLabel, path, end = false }) => (
        <NavLink key={path} to={path} end={end}>
          {itemLabel}
        </NavLink>
      ))}
    </nav>
  );
}
