// No Tauri package is imported by the browser entry path.
export const isDesktop = () => typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
export const DESKTOP_WAKE_EVENT = "echelon:desktop-wake";
export const DESKTOP_AUTH_STATUS_EVENT = "echelon:desktop-auth-status";
