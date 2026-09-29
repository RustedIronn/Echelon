import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (listener) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};
const getSnapshot = () => window.matchMedia(QUERY).matches;

export default function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
