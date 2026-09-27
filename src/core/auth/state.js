import { create } from "zustand";

export const useAuth = create(() => ({
  user: null,
  loading: true,
  initialized: false,
  init: () => {},
}));
