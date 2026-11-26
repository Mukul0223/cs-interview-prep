import { Loader } from "lucide-react";
import { useAuth } from "./useAuth";
import { Outlet, Navigate, useLocation } from "react-router";

export function ProtectedRoute() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div role="status" className="flex items-center justify-center py-16">
        <Loader
          aria-hidden="true"
          className="h-6 w-6 motion-safe:animate-spin"
        />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (status !== "authenticated" || user === null) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
