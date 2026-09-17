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
import { useAuth } from "@core/auth/store";
import { hasMatchingOwnership } from "@core/auth/ownership";
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

const hasOwnedAccess = (owner) => hasMatchingOwnership(
  useAuth.getState().user?.uid ?? null,
  getStorageOwner(),
  owner,
);

export const useSchedule = create((set, get) => ({
  owner: getStorageOwner(),
  ...stateFromDocument(initialDocument),

  updateTask: (id, data) => {
    if (!hasOwnedAccess(get().owner)) return false;
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
    });
    return true;
  },

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

        if (
          !resolution.value ||
          !hasMatchingOwnership(
            useAuth.getState().user?.uid ?? null,
            getStorageOwner(),
            useSchedule.getState().owner,
          ) ||
          useSchedule.getState().owner !== uid
        ) return;

        saveData("echelon_schedule", resolution.value);
        set(stateFromDocument(resolution.value));
      },
      { applyNull: true },
    ),
}));

subscribeStorageOwner(() => {
  useSchedule.setState({
    owner: getStorageOwner(),
    ...stateFromDocument(loadLocalDocument()),
  });
});
