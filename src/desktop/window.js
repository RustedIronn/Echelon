import { isDesktop } from "./environment";

export async function restoreDesktopWindow() {
  if (!isDesktop()) return false;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("restore_main");
    return true;
  } catch {
    return false;
  }
}

export async function readDesktopPause() {
  if (!isDesktop()) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("notifications_paused");
}

export async function setDesktopPause(paused) {
  if (!isDesktop()) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("set_notifications_paused", { paused });
  return true;
}
