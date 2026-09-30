import { create } from "zustand";

import {
  getStorageOwner,
  subscribeStorageOwner,
} from "@/shared/storage";
import { getToday } from "@/shared/date";
import {
  createNextRevision,
  reconcileVersionedState,
} from "@/shared/versionedState";
import { syncToCloud, loadFromCloud } from "@core/cloudSync";
import { useAuth } from "@core/auth/authStore";
import { hasMatchingOwnership } from "@core/auth/authOwnership";
import { saveHabits, loadHabits } from "./service";
import {
  createHabits,
  normalizeHabitDocument,
  toggleHabitById,
} from "./habits";
import { loadHabitDocument, saveHabitDocument } from "./storage";

const loadLocalDocument = () => loadHabitDocument(getToday());

const initialDocument = loadLocalDocument();
const stateFromDocument = (document) => ({
  habits: document?.data ?? createHabits(),
  revision: document?.revision ?? 0,
  updatedAt: document?.updatedAt ?? null,
});

const hasOwnedAccess = (owner) => hasMatchingOwnership(
  useAuth.getState().user?.uid ?? null,
  getStorageOwner(),
  owner,
);

export const useHabits = create((set, get) => ({
  owner: getStorageOwner(),
  ...stateFromDocument(initialDocument),

  rolloverDay: () => {
    set(stateFromDocument(loadLocalDocument()));
    return useHabits.getState().loadFromCloud();
  },

  toggleHabit: (id) => {
    if (!hasOwnedAccess(get().owner)) return false;
    const state = get();
    const habits = toggleHabitById(state.habits, id);
    if (habits === state.habits) return false;

    const document = createNextRevision({
      date: getToday(),
      data: habits,
    }, state);

    const persisted = saveHabitDocument(document);
    if (!persisted) return false;

    set({
      habits: persisted.data,
      revision: persisted.revision,
      updatedAt: persisted.updatedAt,
    });
    syncToCloud("habits", (uid) => saveHabits(uid, persisted));
    return true;
  },

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadHabits(uid, getToday()),
      async (cloud, uid) => {
        const local = loadLocalDocument();
        const safeCloud = normalizeHabitDocument(cloud, getToday());
        const resolution = await reconcileVersionedState({
          local,
          cloud: safeCloud,
          selectContent: ({ date, data }) => ({ date, data }),
          uploadLocal: (document) => saveHabits(uid, document),
        });

        if (
          !resolution.value ||
          !hasMatchingOwnership(
            useAuth.getState().user?.uid ?? null,
            getStorageOwner(),
            useHabits.getState().owner,
          ) ||
          useHabits.getState().owner !== uid
        ) return;

        const persisted = saveHabitDocument(resolution.value);
        if (!persisted) return;
        set(stateFromDocument(persisted));
      },
      { applyNull: true },
    ),
}));

subscribeStorageOwner(() => {
  useHabits.setState({
    owner: getStorageOwner(),
    ...stateFromDocument(loadLocalDocument()),
  });
});
