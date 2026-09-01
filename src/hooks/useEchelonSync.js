import { useEffect } from "react";

import { useSync } from "@/ui/useSync";

import { useAuth } from "@core/auth/store";
import { useSchedule } from "@/features/schedule/scheduleStore";
import { useToday } from "@/features/schedule/todayStore";
import { useHabits } from "@features/habits/store";
import { useFocus } from "@features/focus/store";
import { useWorkout } from "@features/workout/store";

export default function useEchelonSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      useSync.getState().resetSync();
      return;
    }

    const sync = async () => {
      const { status } = useSync.getState();

      if (status === "syncing") return;

      useSync.getState().setSyncing();

      try {
        await Promise.all([
          useToday.getState().loadFromCloud(),
          useHabits.getState().loadFromCloud(),
          useFocus.getState().loadFromCloud(),
          useSchedule.getState().loadFromCloud(),
          useWorkout.getState().loadFromCloud(),
        ]);

        useSync.getState().setSynced();
      } catch (error) {
        console.error("Echelon sync failed:", error);
        useSync.getState().setSyncError();
      }
    };

    sync();
  }, [user]);
}
