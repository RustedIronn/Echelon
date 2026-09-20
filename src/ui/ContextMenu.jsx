import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MENU_WIDTH = 208;
const MENU_HEIGHT_ESTIMATE = 220;

export default function ContextMenu({ label, items, children }) {
  const menuId = useId();
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [position, setPosition] = useState(null);

  const close = () => setPosition(null);
  const openAt = (left, top) => {
    setPosition({
      left: Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8)),
      top: Math.max(8, Math.min(top, window.innerHeight - MENU_HEIGHT_ESTIMATE)),
    });
  };

  useEffect(() => {
    if (!position) return undefined;

    menuRef.current?.querySelector("button:not(:disabled)")?.focus();

    const dismissOutside = (event) => {
      if (
        menuRef.current?.contains(event.target) ||
        triggerRef.current?.contains(event.target)
      ) return;
      setPosition(null);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setPosition(null);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const buttons = [...menuRef.current.querySelectorAll("button:not(:disabled)")];
      const current = buttons.indexOf(document.activeElement);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = (current + direction + buttons.length) % buttons.length;
      event.preventDefault();
      buttons[next]?.focus();
    };

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [position]);

  const triggerProps = {
    ref: triggerRef,
    type: "button",
    className: "context-menu-trigger",
    "aria-label": label,
    "aria-haspopup": "menu",
    "aria-expanded": Boolean(position),
    "aria-controls": menuId,
    onClick: (event) => {
      event.stopPropagation();
      if (position) {
        close();
        return;
      }
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) openAt(rect.right - MENU_WIDTH, rect.bottom + 6);
    },
    onKeyDown: (event) => {
      event.stopPropagation();
      if (event.key !== "ArrowDown") return;
      event.preventDefault();
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) openAt(rect.right - MENU_WIDTH, rect.bottom + 6);
    },
  };

  const contextProps = {
    onContextMenu: (event) => {
      event.preventDefault();
      openAt(event.clientX, event.clientY);
    },
  };

  return (
    <>
      {children({ triggerProps, contextProps })}
      {position
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              className="context-menu"
              role="menu"
              aria-label={label}
              style={position}
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={item.tone === "danger" ? "is-danger" : ""}
                  disabled={item.disabled}
                  onClick={() => {
                    close();
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
