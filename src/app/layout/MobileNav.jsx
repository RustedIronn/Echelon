import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useSync } from "@/ui/useSync";
import { useFocus } from "@features/focus/store";
import { useFocusSurface } from "@features/focus/surface";

import {
  mobileMoreNavigation,
  mobilePrimaryNavigation,
} from "./navigation";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const moreRef = useRef(null);
  const moreButtonRef = useRef(null);
  const location = useLocation();
  const { status } = useSync();
  const sessionTask = useFocus((state) => state.task);
  const openFocus = useFocusSurface((state) => state.openFor);
  const moreActive = mobileMoreNavigation.some(
    ({ path }) => location.pathname.startsWith(path),
  );

  useEffect(() => {
    if (!open) return undefined;

    const dismissOnPointerDown = (event) => {
      if (!moreRef.current?.contains(event.target)) setOpen(false);
    };
    const dismissOnEscape = (event) => {
      if (event.key !== "Escape") return;

      setOpen(false);
      moreButtonRef.current?.focus();
    };

    document.addEventListener("pointerdown", dismissOnPointerDown);
    document.addEventListener("keydown", dismissOnEscape);

    return () => {
      document.removeEventListener("pointerdown", dismissOnPointerDown);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [open]);

  return (
    <>
      <header className="mobile-topbar">
        <span className="mobile-topbar-brand">
          <span className="mobile-topbar-mark"><img src="/assets/echelon.svg" alt="" /></span>
          <span><strong>Echelon</strong><small>Personal orbit</small></span>
        </span>
        <span className={`mobile-sync mobile-sync--${status}`} aria-label={`Sync status: ${status}`}>
          <span aria-hidden="true" />
        </span>
        {sessionTask ? <button type="button" className="mobile-session-link" onClick={() => openFocus()} aria-label={`Resume focus on ${sessionTask.title}`}>Session</button> : null}
      </header>
      <nav className="mobile-nav" aria-label="Primary navigation">
      {mobilePrimaryNavigation.map(({ id, label, path, icon: Icon }) => (
        <NavLink key={id} to={path} end={path === "/"} onClick={() => setOpen(false)}>
          <Icon size={22} />

          <span>{label}</span>
        </NavLink>
      ))}
      <div className="mobile-more" ref={moreRef}>
        <button
          ref={moreButtonRef}
          type="button"
          className={moreActive ? "active" : ""}
          aria-expanded={open}
          aria-controls="mobile-more-menu"
          onClick={() => setOpen((current) => !current)}
        >
          <Menu size={22} />
          <span>More</span>
        </button>
        {open ? (
          <div className="mobile-more-menu" id="mobile-more-menu" role="dialog" aria-label="More destinations">
            <p>More destinations</p>
            {mobileMoreNavigation.map(({ id, label, path, icon: Icon }) => (
              <NavLink key={id} to={path} onClick={() => setOpen(false)}>
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ) : null}
      </div>
      </nav>
    </>
  );
}
