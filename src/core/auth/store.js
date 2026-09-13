import { create } from "zustand";
import { createUserProfile } from "./user";

import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebase";
import { setStorageOwner } from "@/shared/storage";

let authRevision = 0;

export const useAuth = create((set, get) => ({
  user: null,

  loading: true,

  initialized: false,

  init: () => {
    if (get().initialized) return;

    set({
      initialized: true,
    });

    onAuthStateChanged(auth, async (user) => {
      const revision = ++authRevision;

      // Switch the local persistence namespace before any feature can observe
      // the new auth state or begin loading cloud data for it.
      setStorageOwner(user?.uid ?? null);

      try {
        if (user) {
          await createUserProfile(user);
        }
      } catch (error) {
        console.error("Unable to create user profile:", error);
      } finally {
        if (revision === authRevision) {
          set({
            user,
            loading: false,
          });
        }
      }
    });
  },
}));
