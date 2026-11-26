import { Loader } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./useAuth";

export function AdminRoute() {
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

  if (status === "unauthenticated" || user === null) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-2xl">Permission denied</p>
      </div>
    );
  }

  return <Outlet />;
}
