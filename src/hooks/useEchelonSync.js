import { useEffect } from "react";

import { useSync } from "@/ui/useSync";

import { useAuth } from "@core/auth/store";
import { useSchedule } from "@/features/schedule/scheduleStore";
import { useToday } from "@/features/schedule/todayStore";
import { useHabits } from "@features/habits/store";
import { useFocus } from "@features/focus/store";
import { useWorkout } from "@features/workout/store";
import {
  bindMoneyBackgroundRecovery,
  startMoneyBackgroundSync,
  stopMoneyBackgroundSync,
} from "@features/money/backgroundSync";

export default function useEchelonSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      useSync.getState().resetSync();
      return;
    }

    let cancelled = false;
    const unbindMoneyRecovery = bindMoneyBackgroundRecovery(user.uid);

    const sync = async () => {
      useSync.getState().setSyncing();

      try {
        await Promise.all([
          useToday.getState().loadFromCloud(),
          useHabits.getState().loadFromCloud(),
          useFocus.getState().loadFromCloud(),
          useSchedule.getState().loadFromCloud(),
          useWorkout.getState().loadFromCloud(),
          startMoneyBackgroundSync(user.uid),
        ]);

        if (
          !cancelled &&
          useAuth.getState().user?.uid === user.uid &&
          useSync.getState().status !== "error"
        ) {
          useSync.getState().setSynced();
        }
      } catch (error) {
        console.error("Echelon sync failed:", error);

        if (!cancelled && useAuth.getState().user?.uid === user.uid) {
          useSync.getState().setSyncError();
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
