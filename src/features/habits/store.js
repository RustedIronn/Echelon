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

export const useHabits = create((set) => ({
  ...stateFromDocument(initialDocument),

  rolloverDay: () => {
    set(stateFromDocument(loadLocalDocument()));
    return useHabits.getState().loadFromCloud();
  },

  toggleHabit: (name) =>
    set((state) => {
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

      saveData("echelon_habits", document);
      syncToCloud((uid) => saveHabits(uid, document));

      return {
        habits,
        revision: document.revision,
        updatedAt: document.updatedAt,
      };
    }),

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

        if (!resolution.value || getStorageOwner() !== uid) return;

        saveData("echelon_habits", resolution.value);
        set(stateFromDocument(resolution.value));
      },
      { applyNull: true },
    ),
}));

subscribeStorageOwner(() => {
  useHabits.setState(stateFromDocument(loadLocalDocument()));
});
