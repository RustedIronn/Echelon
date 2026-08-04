import { useEffect } from "react";
import { useSync } from "@store/useSync";

import { useAuth } from "@store/useAuth";
import { useSchedule } from "@store/useSchedule";

import { useLockIn } from "@store/useLockIn";
import { useHabits } from "@store/useHabits";
import { useFocus } from "@store/useFocus";

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
          useLockIn.getState().loadFromCloud(),

          useHabits.getState().loadFromCloud(),

          useFocus.getState().loadFromCloud(),

          useSchedule.getState().loadFromCloud(),
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
