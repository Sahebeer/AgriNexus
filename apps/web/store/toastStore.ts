import { create } from "zustand";

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
  isOpen: boolean;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: "",
  type: "info",
  isOpen: false,
  showToast: (message, type = "info") => {
    set({ message, type, isOpen: true });
    // Automatically close toast after 3.5 seconds
    setTimeout(() => {
      set({ isOpen: false });
    }, 3500);
  },
  hideToast: () => set({ isOpen: false })
}));
