import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Cargando...</div>;
  }
  if (!session) return <Navigate to="/login" replace />;
  if (!profile?.active) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm px-4 text-center">
        Tu usuario no tiene un perfil activo. Consultá con el administrador.
      </div>
    );
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
