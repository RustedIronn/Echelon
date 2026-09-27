import { isDesktop } from "./environment.js";

let permission = "default";
let paused = false;
const pauseListeners = new Set();

export const desktopPermission = () => permission;
export const desktopNotificationsPaused = () => paused;
export const subscribeDesktopPause = (listener) => {
  pauseListeners.add(listener);
  return () => pauseListeners.delete(listener);
};

export function updateDesktopPause(value) {
  paused = Boolean(value);
  pauseListeners.forEach((listener) => listener(paused));
}

export async function refreshDesktopPermission() {
  if (!isDesktop()) return "unsupported";
  try {
    const { isPermissionGranted } = await import("@tauri-apps/plugin-notification");
    permission = await isPermissionGranted() ? "granted" : permission === "denied" ? "denied" : "default";
  } catch {
    permission = "unsupported";
  }
  return permission;
}

export async function requestDesktopPermission() {
  if (!isDesktop()) return "unsupported";
  try {
    const native = await import("@tauri-apps/plugin-notification");
    permission = await native.isPermissionGranted() ? "granted" : await native.requestPermission();
  } catch {
    permission = "unsupported";
  }
  return permission;
}

const notificationId = (key) => {
  let hash = 2166136261;
  for (const char of String(key)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash | 0;
};

export async function showDesktopNotification({ id, body, title = "Echelon" }) {
  if (!isDesktop() || paused || permission !== "granted") return false;
  try {
    const { sendNotification } = await import("@tauri-apps/plugin-notification");
    sendNotification({ id: notificationId(id), title, body });
    return true;
  } catch {
    return false;
  }
}
