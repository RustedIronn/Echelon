import { create } from "zustand";
import { createUserProfile } from "./user";

import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebase";
import { setStorageOwner } from "@/shared/storage";
import { useSync } from "@/ui/useSync";
import { createAuthTransitionController } from "./transition";

let transitionController = null;

export const useAuth = create((set, get) => ({
  user: null,

  loading: true,

  initialized: false,

  init: () => {
    if (get().initialized) return;

    set({
      initialized: true,
    });

    if (!transitionController) {
      transitionController = createAuthTransitionController({
        setAuthState: (state) => useAuth.setState(state),
        setStorageOwner,
        resetSync: (uid) => useSync.getState().resetSync(uid),
        initializeProfile: createUserProfile,
        onProfileError: (error) => {
          console.error("Unable to create user profile:", error);
        },
      });
    }

    onAuthStateChanged(auth, (user) => {
      void transitionController.handleAuthChange(user);
    });
  },
}));
