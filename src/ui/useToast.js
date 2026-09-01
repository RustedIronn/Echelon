import { create } from "zustand";

let timeoutId = null;

export const useToast = create((set) => ({
  toast: null,

  show: (message, type = "default", duration = 2500) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    set({
      toast: {
        message,
        type,
      },
    });

    timeoutId = setTimeout(() => {
      set({
        toast: null,
      });

      timeoutId = null;
    }, duration);
  },

  hide: () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    set({
      toast: null,
    });
  },
}));
