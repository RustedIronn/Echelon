import { useEffect } from "react";
import { useSync } from "@store/useSync";

import { useAuth } from "@store/useAuth";
import { useSchedule } from "@features/schedule/store";

import { useToday } from "@features/schedule/today";
import { useHabits } from "@features/habits/store";
import { useFocus } from "@features/focus/store";
import { useWorkout } from "@features/workout/store";

export default function useEchelonSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      useSync.getState().setSynced(false);

      return;
    }

    const sync = async () => {
      const syncing = useSync.getState().syncing;

      if (syncing) return;

      useSync.getState().setSyncing(true);

      try {
        await Promise.all([
          useToday.getState().loadFromCloud(),

          useHabits.getState().loadFromCloud(),

          useFocus.getState().loadFromCloud(),

          useSchedule.getState().loadFromCloud(),

          useWorkout.getState().loadFromCloud(),
        ]);

        useSync.getState().setSynced(true);
      } catch (error) {
        console.error("Echelon sync failed:", error);
        useSync.getState().setSynced(false);
      } finally {
        useSync.getState().setSyncing(false);
      }
    };

    sync();
  }, [user]);
}
