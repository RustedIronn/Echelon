import { isDesktop } from "./environment";

export async function desktopAutostartEnabled() {
  if (!isDesktop() || import.meta.env.DEV) return false;
  const { isEnabled } = await import("@tauri-apps/plugin-autostart");
  return isEnabled();
}

export async function setDesktopAutostart(enabled) {
  if (!isDesktop()) return false;
  if (import.meta.env.DEV) {
    throw new Error("Windows startup can only be configured from an installed Echelon build.");
  }
  const { enable, disable, isEnabled } = await import("@tauri-apps/plugin-autostart");
  await (enabled ? enable() : disable());
  return isEnabled();
}
