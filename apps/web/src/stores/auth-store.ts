import type { AuthSessionData, AuthUser } from '@aurelia/contracts';
import { create } from 'zustand';

type AuthState = {
  accessToken: string | null;
  isHydrated: boolean;
  user: AuthUser | null;
  clearSession: () => void;
  setHydrated: (isHydrated: boolean) => void;
  setSession: (session: AuthSessionData) => void;
  setUser: (user: AuthUser) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  isHydrated: false,
  user: null,
  clearSession: () => set({ accessToken: null, isHydrated: true, user: null }),
  setHydrated: (isHydrated) => set({ isHydrated }),
  setSession: (session) =>
    set({
      accessToken: session.accessToken,
      isHydrated: true,
      user: session.user,
    }),
  setUser: (user) => set({ user }),
}));
