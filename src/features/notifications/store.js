import { create } from "zustand";

import {
  getStorageOwner,
  loadData,
  saveData,
  subscribeStorageOwner,
} from "@/shared/storage";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  MAX_NOTIFICATION_HISTORY,
  NOTIFICATION_HISTORY_KEY,
  NOTIFICATION_SETTINGS_KEY,
  NOTIFICATION_STATUSES,
} from "./constants";
import {
  getNotificationPermission,
  requestNotificationPermission,
} from "./permissions";
import { normalizeNotificationSettings } from "./utils";

const validStatuses = new Set(Object.values(NOTIFICATION_STATUSES));

const normalizeHistory = (value) =>
  (Array.isArray(value) ? value : [])
    .filter(
      (record) =>
        record &&
        typeof record.id === "string" &&
        typeof record.scheduledFor === "string" &&
        validStatuses.has(record.status),
    )
    .slice(-MAX_NOTIFICATION_HISTORY);

const loadSettings = () =>
  normalizeNotificationSettings(
    loadData(NOTIFICATION_SETTINGS_KEY, DEFAULT_NOTIFICATION_SETTINGS),
  );

const loadHistory = () =>
  normalizeHistory(loadData(NOTIFICATION_HISTORY_KEY, []));

const persistSettings = (settings) => {
  const normalized = normalizeNotificationSettings(settings);
  return saveData(NOTIFICATION_SETTINGS_KEY, normalized) ? normalized : null;
};

const persistHistory = (history) => {
  const normalized = normalizeHistory(history);
  return saveData(NOTIFICATION_HISTORY_KEY, normalized) ? normalized : null;
};

export const useNotifications = create((set, get) => ({
  owner: getStorageOwner(),
  settings: loadSettings(),
  history: loadHistory(),
  reminders: [],
  permission: getNotificationPermission(),

  updateSettings: (patch) => {
    const settings = persistSettings({ ...get().settings, ...patch });
    if (!settings) return false;
    set({ settings });
    return true;
  },

  updateQuietHours: (patch) => {
    const current = get().settings;
    const settings = persistSettings({
      ...current,
      quietHours: { ...current.quietHours, ...patch },
    });
    if (!settings) return false;
    set({ settings });
    return true;
  },

  enableBrowserNotifications: async () => {
    const permission = await requestNotificationPermission();
    const persisted =
      permission === "granted"
        ? persistSettings({ ...get().settings, browserEnabled: true })
        : persistSettings({ ...get().settings, browserEnabled: false });

    set(persisted ? { permission, settings: persisted } : { permission });
    return permission === "granted" && !persisted ? null : permission;
  },

  refreshPermission: () => {
    const permission = getNotificationPermission();
    set((state) =>
      state.permission === permission ? state : { permission },
    );
    return permission;
  },

  setReminders: (reminders) => set({ reminders }),

  recordStatus: (reminders, status) => {
    const items = Array.isArray(reminders) ? reminders : [reminders];
    const byId = new Map(get().history.map((record) => [record.id, record]));
    const updatedAt = new Date().toISOString();

    items.filter(Boolean).forEach((reminder) => {
      byId.delete(reminder.id);
      byId.set(reminder.id, { ...reminder, status, updatedAt });
    });

    const history = persistHistory([...byId.values()]);
    if (!history) return false;
    set({ history });
    return true;
  },
}));

subscribeStorageOwner(() => {
  useNotifications.setState({
    owner: getStorageOwner(),
    settings: loadSettings(),
    history: loadHistory(),
    reminders: [],
    permission: getNotificationPermission(),
  });
});
