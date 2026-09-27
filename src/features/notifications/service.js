import { useToast } from "../../ui/useToast.js";
import { canUseBrowserNotifications } from "./permissions.js";
import { isDesktop } from "../../desktop/environment.js";
import { showDesktopNotification } from "../../desktop/notifications.js";

export function showBrowserNotification(
  reminder,
  NotificationApi = globalThis.Notification,
) {
  if (!NotificationApi) return false;

  try {
    const notification = new NotificationApi("Echelon", {
      body: reminder.body,
      tag: reminder.id,
      renotify: false,
    });

    notification.onclick = () => {
      globalThis.focus?.();
      globalThis.location?.assign?.("/schedule");
      notification.close?.();
    };

    return true;
  } catch (error) {
    console.error("Unable to show browser notification:", error);
    return false;
  }
}

export function deliverReminder({ reminder, settings, permission, isFocused }) {
  if (isDesktop()) {
    if (settings?.browserEnabled && permission === "granted" && !isFocused) {
      void showDesktopNotification({ id: reminder.id, body: reminder.body })
        .then((sent) => { if (!sent) useToast.getState().show(reminder.body, "default", 5000); });
      return "desktop";
    }
    useToast.getState().show(reminder.body, "default", 5000);
    return "toast";
  }
  if (canUseBrowserNotifications(settings, permission, isFocused)) {
    if (showBrowserNotification(reminder)) return "browser";
  }

  useToast.getState().show(reminder.body, "default", 5000);
  return "toast";
}
