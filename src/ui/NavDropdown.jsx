import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

export default function NavDropdown({ label, items }) {
  const [openForPath, setOpenForPath] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const location = useLocation();
  const open = openForPath === location.pathname;
  const active = items.some(({ path }) => location.pathname === path);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpenForPath(null);
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setOpenForPath(null);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="nav-dropdown" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={active ? "is-active" : ""}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpenForPath((current) => current === location.pathname ? null : location.pathname)}
      >
        {label}
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open ? (
        <div className="nav-dropdown__menu" role="menu" aria-label={label}>
          {items.map((item) => (
            <NavLink key={item.id} to={item.path} role="menuitem">
              <strong>{item.label}</strong>
              {item.description ? <span>{item.description}</span> : null}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}
