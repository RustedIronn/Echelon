import { create } from "zustand";

import { getStorageOwner, subscribeStorageOwner } from "@/shared/storage";
import { useAuth } from "@core/auth/authStore";

// Presentation state only. The running session and its history remain in Focus.
export const useFocusSurface = create((set, get) => ({
  owner: getStorageOwner(),
  open: false,
  mission: null,
  openFor: (mission = null) => {
    const owner = getStorageOwner();
    if (!owner || get().owner !== owner || useAuth.getState().user?.uid !== owner) return false;
    set({ open: true, mission });
    return true;
  },
  close: () => set({ open: false, mission: null }),
}));

subscribeStorageOwner(() => {
  useFocusSurface.setState({ owner: getStorageOwner(), open: false, mission: null });
});
