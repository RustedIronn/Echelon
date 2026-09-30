import { getToday, parseDayKey } from "../../../shared/date.js";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_STATUSES,
  REMINDER_GRACE_MS,
  REMINDER_LEAD_OPTIONS,
} from "./constants.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeNotificationSettings(value) {
  const leadMinutes = REMINDER_LEAD_OPTIONS.includes(Number(value?.leadMinutes))
    ? Number(value.leadMinutes)
    : DEFAULT_NOTIFICATION_SETTINGS.leadMinutes;
  const quietHours = value?.quietHours;

  return {
    browserEnabled: value?.browserEnabled === true,
    scheduleEnabled: value?.scheduleEnabled !== false,
    leadMinutes,
    quietHours: {
      enabled: quietHours?.enabled === true,
      start: TIME_PATTERN.test(quietHours?.start)
        ? quietHours.start
        : DEFAULT_NOTIFICATION_SETTINGS.quietHours.start,
      end: TIME_PATTERN.test(quietHours?.end)
        ? quietHours.end
        : DEFAULT_NOTIFICATION_SETTINGS.quietHours.end,
    },
  };
}

export function addLocalDays(dateKey, days) {
  const date = parseDayKey(dateKey);
  if (!date) return null;

  date.setDate(date.getDate() + days);
  return getToday(date);
}

export function getScheduleStart(dateKey, start) {
  const date = parseDayKey(dateKey);
  if (!date || !TIME_PATTERN.test(start)) return null;

  const [hours, minutes] = start.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function calculateReminderTime(dateKey, start, leadMinutes) {
  const scheduleStart = getScheduleStart(dateKey, start);
  const lead = Number(leadMinutes);

  if (!scheduleStart || !Number.isFinite(lead) || lead < 0) return null;

  return new Date(scheduleStart.getTime() - lead * 60 * 1000);
}

export function createReminderId({ source, sourceId, date, start, leadMinutes }) {
  return [source, sourceId, date, start, leadMinutes]
    .map((part) => encodeURIComponent(String(part)))
    .join(":");
}

export function createScheduleReminder(task, date, leadMinutes) {
  const scheduledFor = calculateReminderTime(date, task?.start, leadMinutes);

  if (
    !scheduledFor ||
    (typeof task?.id !== "string" && typeof task?.id !== "number") ||
    typeof task?.title !== "string"
  ) {
    return null;
  }

  const id = createReminderId({
    source: "schedule",
    sourceId: task.id,
    date,
    start: task.start,
    leadMinutes,
  });
  const createdAt = getScheduleStart(date, "00:00").toISOString();

  return {
    id,
    source: "schedule",
    sourceId: task.id,
    date,
    scheduledFor: scheduledFor.toISOString(),
    title: task.title,
    body:
      leadMinutes === 0
        ? `${task.title} starts now`
        : `${task.title} starts in ${leadMinutes} minutes`,
    leadMinutes,
    status: NOTIFICATION_STATUSES.pending,
    createdAt,
    updatedAt: createdAt,
  };
}

export function deriveScheduleReminders(
  schedule,
  settings,
  now = new Date(),
) {
  const safeSettings = normalizeNotificationSettings(settings);
  if (!safeSettings.scheduleEnabled || !Array.isArray(schedule)) return [];

  const today = getToday(now);
  const tomorrow = addLocalDays(today, 1);
  const currentDayReminders = schedule
    .map((task) =>
      createScheduleReminder(task, today, safeSettings.leadMinutes),
    )
    .filter(Boolean);
  const crossingReminders = schedule
    .map((task) =>
      createScheduleReminder(task, tomorrow, safeSettings.leadMinutes),
    )
    .filter(
      (reminder) =>
        reminder && getToday(new Date(reminder.scheduledFor)) === today,
    );

  return [...currentDayReminders, ...crossingReminders];
}

const timeToMinutes = (time) => {
  if (!TIME_PATTERN.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export function isWithinQuietHours(date, quietHours) {
  if (!quietHours?.enabled) return false;

  const start = timeToMinutes(quietHours.start);
  const end = timeToMinutes(quietHours.end);
  if (start === null || end === null || start === end) return false;

  const current = date.getHours() * 60 + date.getMinutes();

  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

export function planReminders(
  reminders,
  history,
  now = new Date(),
  graceMs = REMINDER_GRACE_MS,
) {
  const terminalIds = new Set(
    Array.isArray(history)
      ? history
          .filter((record) => record?.status !== NOTIFICATION_STATUSES.pending)
          .map((record) => record.id)
      : [],
  );
  const schedulable = [];
  const missed = [];

  for (const reminder of Array.isArray(reminders) ? reminders : []) {
    if (!reminder?.id || terminalIds.has(reminder.id)) continue;

    const scheduledTime = Date.parse(reminder.scheduledFor);
    if (Number.isNaN(scheduledTime)) continue;

    if (scheduledTime < now.getTime() - graceMs) {
      missed.push(reminder);
    } else {
      schedulable.push(reminder);
    }
  }

  return { schedulable, missed };
}
