import { createUserProfile } from "./userProfile.js";

import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebase.js";
import { setStorageOwner } from "../../shared/storage.js";
import { useSync } from "../../ui/useSync.js";
import { createAuthTransitionController } from "./authTransition.js";
import { useAuth } from "./authState.js";

let transitionController = null;

const init = () => {
    if (useAuth.getState().initialized) return;

    useAuth.setState({
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
};

useAuth.setState({ init });

export { useAuth };
