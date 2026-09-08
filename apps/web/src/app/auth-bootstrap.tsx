import { useEffect, type PropsWithChildren } from 'react';
import { authApi } from '../lib/auth-api';
import { useAuthStore } from '../stores/auth-store';

let hydrationPromise: Promise<void> | null = null;

const hydrateAuthentication = () => {
  hydrationPromise ??= authApi
    .refresh()
    .then((session) => useAuthStore.getState().setSession(session))
    .catch(() => useAuthStore.getState().clearSession())
    .finally(() => {
      hydrationPromise = null;
    });
  return hydrationPromise;
};

export const AuthBootstrap = ({ children }: PropsWithChildren) => {
  const isHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    if (isHydrated) return;

    void hydrateAuthentication();
  }, [isHydrated]);

  return children;
};
