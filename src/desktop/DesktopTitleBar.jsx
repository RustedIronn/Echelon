import { Maximize2, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isDesktop } from "./environment";

async function withWindow(action) {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return await action(getCurrentWindow());
  } catch {
    return null;
  }
}

export default function DesktopTitleBar() {
  const desktop = isDesktop();
  const [maximized, setMaximized] = useState(null);

  useEffect(() => {
    if (!desktop) return undefined;
    let disposed = false;
    let stopResize = null;
    const synchronize = async (window) => {
      const value = await window.isMaximized();
      if (!disposed) setMaximized(value);
    };
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const window = getCurrentWindow();
      await synchronize(window);
      stopResize = await window.onResized(() => { void synchronize(window).catch(() => {}); });
    })().catch(() => {
      if (!disposed) setMaximized(false);
    });
    return () => {
      disposed = true;
      stopResize?.();
    };
  }, [desktop]);

  if (!desktop) return null;

  const minimize = () => void withWindow((window) => window.minimize());
  const toggleMaximize = () => void withWindow(async (window) => {
    await window.toggleMaximize();
    setMaximized(await window.isMaximized());
  });
  const close = () => void withWindow((window) => window.close());

  return (
    <header className="desktop-titlebar" data-tauri-drag-region onDoubleClick={toggleMaximize}>
      <div className="desktop-titlebar-brand" data-tauri-drag-region>
        <img src="/assets/echelon.svg" alt="" />
        <span data-tauri-drag-region>Echelon</span>
      </div>

      <div className="desktop-window-controls" aria-label="Window controls" onDoubleClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={minimize} aria-label="Minimize Echelon">
          <Minus size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={toggleMaximize} aria-label={maximized ? "Restore Echelon" : "Maximize Echelon"}>
          {maximized ? <Square size={13} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
        </button>
        <button type="button" className="desktop-window-close" onClick={close} aria-label="Close Echelon to the system tray">
          <X size={17} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
