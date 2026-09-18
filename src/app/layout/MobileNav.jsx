import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";

import {
  mobileMoreNavigation,
  mobilePrimaryNavigation,
} from "./navigation";

export default function MobileNav() {
  const [openPath, setOpenPath] = useState(null);
  const location = useLocation();
  const open = openPath === location.pathname;
  const moreActive = mobileMoreNavigation.some(
    ({ path }) => location.pathname.startsWith(path),
  );

  return (
    <nav className="mobile-nav">
      {mobilePrimaryNavigation.map(({ id, label, path, icon: Icon }) => (
        <NavLink key={id} to={path}>
          <Icon size={22} />

          <span>{label}</span>
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
            {mobileMoreNavigation.map(({ id, label, path, icon: Icon }) => (
              <NavLink key={id} to={path} onClick={() => setOpenPath(null)}>
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
