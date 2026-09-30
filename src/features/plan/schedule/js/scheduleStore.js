import { create } from "zustand";

import {
  schedule as defaultSchedule,
  isValidSchedule,
  normalizeSchedule,
  normalizeScheduleItems,
} from "./scheduleDefaults";
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
import { useAuth } from "@core/auth/authStore";
import { hasMatchingOwnership } from "@core/auth/authOwnership";
import { loadScheduleCloud, saveScheduleCloud } from "./scheduleRemote";

const normalizeDocument = (value) => {
  const schedule = Array.isArray(value) ? value : value?.schedule;
  const normalized = normalizeScheduleItems(schedule);

  if (!normalized) return null;

  return {
    schedule: normalized,
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

  replaceSchedule: (schedule) => {
    if (!hasOwnedAccess(get().owner)) return false;
    if (!isValidSchedule(schedule)) return false;

    const state = get();
    const normalized = normalizeSchedule(schedule);
    const document = createNextRevision({ schedule: normalized }, state);

    if (!saveData("echelon_schedule", document)) return false;

    set({
      schedule: normalized,
      revision: document.revision,
      updatedAt: document.updatedAt,
    });
    syncToCloud("schedule", (uid) => saveScheduleCloud(uid, document));
    return true;
  },

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadScheduleCloud(uid),
      async (cloud, uid) => {
        const resolution = await reconcileVersionedState({
          local: loadLocalDocument(),
          cloud: normalizeDocument(cloud),
          selectContent: ({ schedule }) => schedule,
          uploadLocal: (document) => saveScheduleCloud(uid, document),
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

        if (!saveData("echelon_schedule", resolution.value)) return;
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
