import { create } from "zustand";

import {
  schedule as defaultSchedule,
  isValidSchedule,
  normalizeSchedule,
} from "./constants";
import {
  getStorageOwner,
  saveData,
  loadData,
  subscribeStorageOwner,
} from "@/shared/storage";
import {
  createNextRevision,
  reconcileVersionedState,
} from "@/shared/versionedState";
import { syncToCloud, loadFromCloud } from "@core/cloudSync";
import { saveSchedule, loadSchedule } from "./scheduleService";

const normalizeDocument = (value) => {
  const schedule = Array.isArray(value) ? value : value?.schedule;

  if (!isValidSchedule(schedule)) return null;

  return {
    schedule: normalizeSchedule(schedule),
    revision: Number.isInteger(value?.revision) ? value.revision : 0,
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : null,
  };
};

const loadLocalDocument = () =>
  normalizeDocument(loadData("echelon_schedule", null));

const initialDocument = loadLocalDocument();
const stateFromDocument = (document) => ({
  schedule: document?.schedule ?? defaultSchedule,
  revision: document?.revision ?? 0,
  updatedAt: document?.updatedAt ?? null,
});

export const useSchedule = create((set) => ({
  ...stateFromDocument(initialDocument),

  updateTask: (id, data) =>
    set((state) => {
      const updated = state.schedule.map((task) =>
        task.id === id
          ? {
              ...task,
              ...data,
            }
          : task,
      );

      const document = createNextRevision({ schedule: updated }, state);

      saveData("echelon_schedule", document);
      syncToCloud((uid) => saveSchedule(uid, document));

      return {
        schedule: updated,
        revision: document.revision,
        updatedAt: document.updatedAt,
      };
    }),

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadSchedule(uid),
      async (cloud, uid) => {
        const resolution = await reconcileVersionedState({
          local: loadLocalDocument(),
          cloud: normalizeDocument(cloud),
          selectContent: ({ schedule }) => schedule,
          uploadLocal: (document) => saveSchedule(uid, document),
        });

        if (!resolution.value || getStorageOwner() !== uid) return;

        saveData("echelon_schedule", resolution.value);
        set(stateFromDocument(resolution.value));
      },
      { applyNull: true },
    ),
}));

subscribeStorageOwner(() => {
  useSchedule.setState(stateFromDocument(loadLocalDocument()));
});
