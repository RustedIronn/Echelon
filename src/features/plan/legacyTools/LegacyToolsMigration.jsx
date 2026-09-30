import { useEffect } from "react";

import { useAuth } from "@core/auth/authStore";
import { getStorageOwner } from "@/shared/storage";
import { usePlanner } from "@features/plan/planner/js/plannerStore";
import { useTools } from "./js/store";

// A source item is marked only after its deterministic Planner copy persisted.
// Retain the legacy record as read-only compatibility data, not an active queue.
export default function LegacyToolsMigration() {
  const uid = useAuth((state) => state.user?.uid ?? null);
  const { owner, data, markLaneMigrated } = useTools();
  const plannerOwner = usePlanner((state) => state.owner);
  const importLegacyLaneTask = usePlanner((state) => state.importLegacyLaneTask);

  useEffect(() => {
    if (!uid || uid !== owner || uid !== plannerOwner || uid !== getStorageOwner()) return;
    for (const task of data.tasks) {
      if (data.migratedLaneIds.includes(task.id)) continue;
      if (importLegacyLaneTask(task)) markLaneMigrated(task.id);
    }
  }, [uid, owner, plannerOwner, data.tasks, data.migratedLaneIds, importLegacyLaneTask, markLaneMigrated]);

  return null;
}
