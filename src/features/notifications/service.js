import { useToast } from "@/ui/useToast";
import { canUseBrowserNotifications } from "./permissions";

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
  if (canUseBrowserNotifications(settings, permission, isFocused)) {
    if (showBrowserNotification(reminder)) return "browser";
  }

  useToast.getState().show(reminder.body, "default", 5000);
  return "toast";
}
