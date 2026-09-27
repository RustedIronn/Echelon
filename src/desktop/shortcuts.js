import { isDesktop } from "./environment";

const QUICK_NOTE_SHORTCUT = "Control+Alt+E";
let status = "unavailable";
const listeners = new Set();

const update = (next) => {
  status = next;
  listeners.forEach((listener) => listener(next));
};

export const quickNoteShortcutStatus = () => status;
export const subscribeQuickNoteShortcut = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export async function registerQuickNoteShortcut(onOpen) {
  if (!isDesktop()) return () => {};
  try {
    const { register, unregister } = await import("@tauri-apps/plugin-global-shortcut");
    await register(QUICK_NOTE_SHORTCUT, (event) => {
      if (event.state === "Pressed") onOpen();
    });
    update("ready");
    return async () => {
      try { await unregister(QUICK_NOTE_SHORTCUT); } finally { update("unavailable"); }
    };
  } catch {
    update("unavailable");
    return () => {};
  }
}
