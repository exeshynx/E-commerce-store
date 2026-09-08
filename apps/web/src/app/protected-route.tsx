import type { UserRole } from '@aurelia/contracts';
import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';

type ProtectedRouteProps = PropsWithChildren<{
  requiredRole?: UserRole;
}>;

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!isHydrated) {
    return (
      <main className="bg-porcelain grid min-h-screen place-items-center">
        <p className="text-ink/55 text-sm tracking-[0.18em] uppercase">Checking your session…</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/account" replace />;
  }

  return children;
};
