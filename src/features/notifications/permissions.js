import { isDesktop } from "../../desktop/environment.js";
import { desktopPermission, requestDesktopPermission } from "../../desktop/notifications.js";

export const PERMISSION_STATES = {
  default: "default",
  granted: "granted",
  denied: "denied",
  unsupported: "unsupported",
};

export function normalizePermissionState(value) {
  return value === PERMISSION_STATES.granted ||
    value === PERMISSION_STATES.denied ||
    value === PERMISSION_STATES.default
    ? value
    : PERMISSION_STATES.unsupported;
}

export function getNotificationPermission(NotificationApi = globalThis.Notification) {
  if (isDesktop()) return desktopPermission();
  if (!NotificationApi) return PERMISSION_STATES.unsupported;
  return normalizePermissionState(NotificationApi.permission);
}

export async function requestNotificationPermission(
  NotificationApi = globalThis.Notification,
) {
  if (isDesktop()) return requestDesktopPermission();
  const current = getNotificationPermission(NotificationApi);

  if (current !== PERMISSION_STATES.default) return current;

  try {
    return normalizePermissionState(await NotificationApi.requestPermission());
  } catch {
    return getNotificationPermission(NotificationApi);
  }
}

export function canUseBrowserNotifications(settings, permission, isFocused) {
  return (
    settings?.browserEnabled === true &&
    permission === PERMISSION_STATES.granted &&
    isFocused === false
  );
}
