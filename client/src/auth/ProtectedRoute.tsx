import { Loader } from "lucide-react";
import { useAuth } from "./useAuth";
import { Outlet, Navigate, useLocation } from "react-router";

export function ProtectedRoute() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader className="h-6 w-6 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (status !== "authenticated" || user === null) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
