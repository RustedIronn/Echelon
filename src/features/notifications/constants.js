export const NOTIFICATION_SETTINGS_KEY = "echelon_notification_settings";
export const NOTIFICATION_HISTORY_KEY = "echelon_notification_history";

export const REMINDER_LEAD_OPTIONS = [0, 5, 10, 15, 30];
export const REMINDER_GRACE_MS = 5 * 60 * 1000;
export const MAX_NOTIFICATION_HISTORY = 200;

export const DEFAULT_NOTIFICATION_SETTINGS = {
  browserEnabled: false,
  scheduleEnabled: true,
  leadMinutes: 10,
  quietHours: {
    enabled: false,
    start: "22:30",
    end: "06:30",
  },
};

export const NOTIFICATION_STATUSES = {
  pending: "pending",
  fired: "fired",
  cancelled: "cancelled",
  missed: "missed",
};
