import { create } from "zustand";
import { createUserProfile } from "@services/user";

import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@config/firebase";

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
      if (user) {
        await createUserProfile(user);
      }

      set({
        user,
        loading: false,
      });
    });
  },
}));
