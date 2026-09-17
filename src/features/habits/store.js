import { create } from "zustand";

import {
  getStorageOwner,
  saveData,
  loadData,
  subscribeStorageOwner,
} from "@/shared/storage";
import { getToday, isNewDay } from "@/shared/date";
import {
  createNextRevision,
  reconcileVersionedState,
} from "@/shared/versionedState";
import { habits as defaultHabits } from "./constants";
import { syncToCloud, loadFromCloud } from "@core/cloudSync";
import { useAuth } from "@core/auth/store";
import { hasMatchingOwnership } from "@core/auth/ownership";
import { saveHabits, loadHabits } from "./service";

const createHabits = () =>
  defaultHabits.map((name) => ({
    name,
    done: false,
  }));

const normalizeHabits = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((habit) => habit && typeof habit.name === "string")
    ? value.map((habit) => ({ ...habit, done: habit.done === true }))
    : createHabits();

const isValidHabits = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((habit) => habit && typeof habit.name === "string");

const normalizeDocument = (value) => {
  if (!value || isNewDay(value.date) || !isValidHabits(value.data)) return null;

  return {
    ...value,
    data: normalizeHabits(value.data),
    revision: Number.isInteger(value.revision) ? value.revision : 0,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
};

const loadLocalDocument = () =>
  normalizeDocument(loadData("echelon_habits", null));

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

  toggleHabit: (name) => {
    if (!hasOwnedAccess(get().owner)) return false;
    const state = get();
    const habits = state.habits.map((habit) =>
      habit.name === name
        ? {
            ...habit,
            done: !habit.done,
          }
        : habit,
    );
    const document = createNextRevision({
      date: getToday(),
      data: habits,
    }, state);

    if (!saveData("echelon_habits", document)) return false;

    set({
      habits,
      revision: document.revision,
      updatedAt: document.updatedAt,
    });
    syncToCloud((uid) => saveHabits(uid, document));
    return true;
  },

  loadFromCloud: () =>
    loadFromCloud(
      (uid) => loadHabits(uid, getToday()),
      async (cloud, uid) => {
        const local = loadLocalDocument();
        const safeCloud = normalizeDocument(cloud);
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

        if (!saveData("echelon_habits", resolution.value)) return;
        set(stateFromDocument(resolution.value));
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
