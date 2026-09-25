import { create } from "zustand";
import {
  clearAuth,
  fetchMe,
  getAccessToken,
  persistAuth,
  type AuthResponse,
  type PublicUser,
} from "./client";

interface AppState {
  token: string | null;
  user: PublicUser | null;
  authHydrated: boolean;

  hydrate: () => Promise<void>;
  applyAuth: (res: AuthResponse) => void;
  signOut: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  token: getAccessToken(),
  user: null,
  authHydrated: false,

  hydrate: async () => {
    if (get().authHydrated) return;
    const token = get().token;
    if (!token) {
      set({ user: null, authHydrated: true });
      return;
    }
    try {
      const { user } = await fetchMe();
      set({ user, authHydrated: true });
    } catch {
      clearAuth();
      set({ token: null, user: null, authHydrated: true });
    }
  },

  applyAuth: (res) => {
    persistAuth(res);
    set({ token: res.accessToken, user: res.user, authHydrated: true });
  },

  signOut: () => {
    clearAuth();
    set({ token: null, user: null, authHydrated: true });
  },
}));