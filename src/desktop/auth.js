import {
  browserLocalPersistence,
  GoogleAuthProvider,
  setPersistence,
  signInWithCredential,
} from "firebase/auth";
import { auth } from "@core/firebase";
import { DESKTOP_AUTH_STATUS_EVENT, isDesktop } from "./environment";
import { restoreDesktopWindow } from "./window";

let activeLogin = null;

function publish(status, message = "") {
  window.dispatchEvent(new CustomEvent(DESKTOP_AUTH_STATUS_EVENT, {
    detail: { status, message },
  }));
}

function readableAuthError(error) {
  const message = String(error?.message ?? error ?? "");
  if (message.includes("oauth_cancelled")) return "Sign-in was cancelled.";
  if (message.includes("oauth_timeout")) return "Sign-in timed out. Please try again.";
  if (message.includes("oauth_in_progress")) return "A Google sign-in is already in progress.";
  if (message.includes("not configured")) return "Desktop Google sign-in is not configured for this build.";
  return message || "Google sign-in could not be completed.";
}

export function beginDesktopGoogleLogin() {
  if (!isDesktop()) return Promise.reject(new Error("Desktop sign-in is only available inside Echelon for Windows."));
  if (activeLogin) return activeLogin;

  const clientId = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID?.trim();
  if (!clientId) return Promise.reject(new Error("Desktop Google sign-in is not configured for this build."));

  activeLogin = (async () => {
    publish("opening", "Opening Google sign-in in your browser…");
    const { invoke } = await import("@tauri-apps/api/core");
    publish("waiting", "Finish signing in in your browser, then return to Echelon.");
    const idToken = await invoke("start_google_oauth", { clientId });
    publish("finishing", "Finishing sign-in…");
    await setPersistence(auth, browserLocalPersistence);
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    await restoreDesktopWindow();
    publish("complete");
    return auth.currentUser;
  })()
    .catch((error) => {
      const message = readableAuthError(error);
      publish(message === "Sign-in was cancelled." ? "cancelled" : "error", message);
      throw new Error(message, { cause: error });
    })
    .finally(() => {
      activeLogin = null;
    });

  return activeLogin;
}

export async function cancelDesktopGoogleLogin() {
  if (!isDesktop() || !activeLogin) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("cancel_google_oauth");
}
