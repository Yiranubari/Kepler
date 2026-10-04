import { create } from "zustand";

const STORAGE_KEY = "kepler.advancedMode";

export interface AdvancedModeState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

function readStoredEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export const useAdvancedMode = create<AdvancedModeState>((set) => ({
  enabled: readStoredEnabled(),
  setEnabled: (enabled) => {
    set({ enabled });
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      return;
    }
  }
}));
