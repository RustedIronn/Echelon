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
  saveData(NOTIFICATION_SETTINGS_KEY, normalized);
  return normalized;
};

const persistHistory = (history) => {
  const normalized = normalizeHistory(history);
  saveData(NOTIFICATION_HISTORY_KEY, normalized);
  return normalized;
};

export const useNotifications = create((set, get) => ({
  owner: getStorageOwner(),
  settings: loadSettings(),
  history: loadHistory(),
  reminders: [],
  permission: getNotificationPermission(),

  updateSettings: (patch) =>
    set((state) => ({
      settings: persistSettings({ ...state.settings, ...patch }),
    })),

  updateQuietHours: (patch) =>
    set((state) => ({
      settings: persistSettings({
        ...state.settings,
        quietHours: { ...state.settings.quietHours, ...patch },
      }),
    })),

  enableBrowserNotifications: async () => {
    const permission = await requestNotificationPermission();
    const settings =
      permission === "granted"
        ? persistSettings({ ...get().settings, browserEnabled: true })
        : persistSettings({ ...get().settings, browserEnabled: false });

    set({ permission, settings });
    return permission;
  },

  refreshPermission: () => {
    const permission = getNotificationPermission();
    set((state) =>
      state.permission === permission ? state : { permission },
    );
    return permission;
  },

  setReminders: (reminders) => set({ reminders }),

  recordStatus: (reminders, status) =>
    set((state) => {
      const items = Array.isArray(reminders) ? reminders : [reminders];
      const byId = new Map(state.history.map((record) => [record.id, record]));
      const updatedAt = new Date().toISOString();

      items.filter(Boolean).forEach((reminder) => {
        byId.delete(reminder.id);
        byId.set(reminder.id, { ...reminder, status, updatedAt });
      });

      return { history: persistHistory([...byId.values()]) };
    }),
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
