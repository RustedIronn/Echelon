import { useEffect, useState } from "react";

import { Button, Card } from "@ui";
import { useNotifications } from "@features/notifications/js/store.js";
import { desktopAutostartEnabled, setDesktopAutostart } from "./autostart";
import { desktopNotificationsPaused, refreshDesktopPermission, subscribeDesktopPause } from "./notifications";
import { quickNoteShortcutStatus, subscribeQuickNoteShortcut } from "./shortcuts";
import { readDesktopPause, setDesktopPause } from "./window";
import { getDesktopBridgeState, retryDesktopBridge, subscribeDesktopBridge } from "./bridge";

export default function DesktopSettings() {
  const permission = useNotifications((state) => state.permission);
  const [autostart, setAutostart] = useState(null);
  const [paused, setPaused] = useState(desktopNotificationsPaused);
  const [shortcut, setShortcut] = useState(quickNoteShortcutStatus);
  const [error, setError] = useState("");
  const [bridge, setBridge] = useState(getDesktopBridgeState);

  useEffect(() => {
    let mounted = true;
    void desktopAutostartEnabled().then((value) => { if (mounted) setAutostart(value); }).catch(() => { if (mounted) setError("Windows startup registration could not be read."); });
    void readDesktopPause().then((value) => { if (mounted) setPaused(value); }).catch(() => { if (mounted) setError("Desktop notification status could not be read."); });
    void refreshDesktopPermission().then((value) => { if (mounted) useNotifications.setState({ permission: value }); });
    const stopPause = subscribeDesktopPause(setPaused);
    const stopShortcut = subscribeQuickNoteShortcut(setShortcut);
    const stopBridge = subscribeDesktopBridge(setBridge);
    return () => { mounted = false; stopPause(); stopShortcut(); stopBridge(); };
  }, []);

  const changeAutostart = async (enabled) => {
    try { setAutostart(await setDesktopAutostart(enabled)); setError(""); }
    catch { setError("Windows startup setting could not be changed."); }
  };
  const changePause = async (enabled) => {
    try { await setDesktopPause(enabled); setPaused(enabled); setError(""); }
    catch { setError("Desktop notification pause could not be changed."); }
  };

  return <Card className="desktop-settings">
    <div className="section-header"><h2>Desktop</h2><p>Windows integration for this device.</p></div>
    <div className="stack">
      <label className="notification-setting"><span><strong>Launch Echelon when Windows starts</strong><small>Reflects Windows startup registration.</small></span><input type="checkbox" checked={autostart === true} disabled={autostart === null} onChange={(event) => void changeAutostart(event.target.checked)} /></label>
      <div className="notification-setting"><span><strong>Desktop notifications</strong><small>Permission: {permission}. Windows notification settings and Focus Assist can still suppress delivery.</small></span></div>
      <div className="notification-setting"><span><strong>Desktop integration</strong><small>{bridge.status === "ready" ? "Ready" : bridge.status === "starting" ? "Starting…" : bridge.status === "failed" ? `Failed: ${bridge.error}` : "Not started"}</small></span>{bridge.status === "failed" ? <Button variant="secondary" onClick={() => void retryDesktopBridge()}>Retry</Button> : null}</div>
      <div className="notification-setting"><span><strong>Quick Note shortcut</strong><small>Ctrl+Alt+E · {shortcut === "ready" ? "available" : "unavailable or already used by another app"}</small></span></div>
      <div className="notification-setting"><span><strong>Close to tray</strong><small>Closing the window keeps Echelon running. Use Quit in the tray to exit.</small></span></div>
      <label className="notification-setting"><span><strong>Pause desktop notifications</strong><small>Temporary, for this running desktop session.</small></span><input type="checkbox" checked={paused} onChange={(event) => void changePause(event.target.checked)} /></label>
      <p className="notification-note">Windows currently delivers native reminder text, but this desktop notification API does not expose a reliable click-activation callback. Open Echelon from the tray to continue in context.</p>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  </Card>;
}
