import { useEffect } from "react";

import { useSync } from "@/ui/useSync";

import { useAuth } from "@core/auth/authStore";
import { useSchedule } from "@/features/plan/schedule/js/scheduleStore";
import { useToday } from "@/features/plan/schedule/js/todayStore";
import { useHabits } from "@features/habits/js/store.js";
import { useFocus } from "@features/focus/js/store.js";
import { useWorkout } from "@features/workouts/js/store.js";
import {
  bindMoneyBackgroundRecovery,
  startMoneyBackgroundSync,
  stopMoneyBackgroundSync,
} from "@features/money/js/backgroundSync.js";

export default function useEchelonSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      useSync.getState().resetSync(null);
      return;
    }

    let cancelled = false;
    const unbindMoneyRecovery = bindMoneyBackgroundRecovery(user.uid);

    const sync = async () => {
      useSync.getState().setSyncStatus("bootstrap", "syncing", user.uid);

      try {
        await Promise.all([
          useToday.getState().loadFromCloud(),
          useHabits.getState().loadFromCloud(),
          useFocus.getState().loadFromCloud(),
          useSchedule.getState().loadFromCloud(),
          useWorkout.getState().loadFromCloud(),
          startMoneyBackgroundSync(user.uid),
        ]);

        if (!cancelled && useAuth.getState().user?.uid === user.uid) {
          useSync.getState().setSyncStatus("bootstrap", "synced", user.uid);
        }
      } catch (error) {
        console.error("Echelon sync failed:", error);

        if (!cancelled && useAuth.getState().user?.uid === user.uid) {
          useSync.getState().setSyncStatus("bootstrap", "error", user.uid);
        }
      }
    };

    sync();

    return () => {
      cancelled = true;
      unbindMoneyRecovery();
      stopMoneyBackgroundSync(user.uid);
    };
  }, [user]);
}
