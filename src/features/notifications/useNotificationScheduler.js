import { useEffect, useRef } from "react";

import { DAY_ROLLOVER_EVENT } from "@/shared/dayRollover";
import { getStorageOwner } from "@/shared/storage";
import { useAuth } from "@core/auth/store";
import { useSchedule } from "@/features/plan/schedule/scheduleStore";
import { useNotifications } from "./store";
import { createReminderScheduler } from "./scheduler";
import {
  deriveScheduleReminders,
  isWithinQuietHours,
  planReminders,
} from "./utils";
import { deliverReminder } from "./service";
import { NOTIFICATION_STATUSES } from "./constants";
import { DESKTOP_WAKE_EVENT, isDesktop } from "../../desktop/environment";
import { desktopNotificationsPaused } from "../../desktop/notifications";

export default function useNotificationScheduler() {
  const schedulerRef = useRef(null);

  if (schedulerRef.current == null) {
    schedulerRef.current = createReminderScheduler();
  }

  useEffect(() => {
    const scheduler = schedulerRef.current;

    const handleDue = (reminder) => {
      const notificationState = useNotifications.getState();
      const activeUid = useAuth.getState().user?.uid ?? null;

      if (
        !activeUid ||
        notificationState.owner !== activeUid ||
        getStorageOwner() !== activeUid
      ) {
        return;
      }

      const { settings, permission, recordStatus } = notificationState;

      if (!settings.scheduleEnabled) return;

      if (isDesktop() && desktopNotificationsPaused()) {
        recordStatus(reminder, NOTIFICATION_STATUSES.missed);
        return;
      }

      if (
        isWithinQuietHours(
          new Date(reminder.scheduledFor),
          settings.quietHours,
        )
      ) {
        recordStatus(reminder, NOTIFICATION_STATUSES.missed);
        return;
      }

      // Persist the terminal state before delivery so refresh/reinitialization
      // cannot deliver the same deterministic reminder twice.
      if (!recordStatus(reminder, NOTIFICATION_STATUSES.fired)) return;
      deliverReminder({
        reminder,
        settings,
        permission,
        isFocused: document.hasFocus(),
      });
    };

    const recompute = () => {
      const now = new Date();
      const notificationState = useNotifications.getState();
      const activeUid = useAuth.getState().user?.uid ?? null;

      if (
        !activeUid ||
        notificationState.owner !== activeUid ||
        getStorageOwner() !== activeUid
      ) {
        scheduler.clear();
        return;
      }

      const reminders = deriveScheduleReminders(
        useSchedule.getState().schedule,
        notificationState.settings,
        now,
      );
      const plan = planReminders(
        reminders,
        notificationState.history,
        now,
      );

      if (plan.missed.length > 0) {
        notificationState.recordStatus(
          plan.missed,
          NOTIFICATION_STATUSES.missed,
        );
      }

      notificationState.setReminders(plan.schedulable);
      scheduler.reconcile(plan.schedulable, handleDue);
    };

    const recover = () => {
      useNotifications.getState().refreshPermission();
      recompute();
    };
    const recoverWhenVisible = () => {
      if (!document.hidden) recover();
    };

    const unsubscribeSchedule = useSchedule.subscribe(recompute);
    const unsubscribeNotifications = useNotifications.subscribe(
      (state, previous) => {
        if (
          state.settings !== previous.settings ||
          state.history !== previous.history ||
          state.owner !== previous.owner
        ) {
          recompute();
        }
      },
    );

    recompute();
    window.addEventListener("focus", recover);
    window.addEventListener(DESKTOP_WAKE_EVENT, recompute);
    window.addEventListener(DAY_ROLLOVER_EVENT, recompute);
    document.addEventListener("visibilitychange", recoverWhenVisible);

    return () => {
      unsubscribeSchedule();
      unsubscribeNotifications();
      scheduler.clear();
      window.removeEventListener("focus", recover);
      window.removeEventListener(DESKTOP_WAKE_EVENT, recompute);
      window.removeEventListener(DAY_ROLLOVER_EVENT, recompute);
      document.removeEventListener("visibilitychange", recoverWhenVisible);
    };
  }, []);
}
