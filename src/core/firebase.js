import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,

  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,

  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,

  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,

  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,

  appId: import.meta.env.VITE_FIREBASE_APP_ID,

  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

const desktopRuntime = typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);

// The installed WebView must keep the Firebase session between launches.
// localStorage is the most reliable first choice for Tauri's stable app origin;
// browsers continue preferring IndexedDB with localStorage as a fallback.
export const auth = initializeAuth(app, {
  persistence: desktopRuntime
    ? [browserLocalPersistence, indexedDBLocalPersistence]
    : [indexedDBLocalPersistence, browserLocalPersistence],
});

export const db = getFirestore(app);
