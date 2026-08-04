import { create } from "zustand";

export const useToast = create((set) => ({
  message: null,

  show: (message) => {
    set({
      message,
    });

    setTimeout(() => {
      set({
        message: null,
      });
    }, 2500);
  },
}));
