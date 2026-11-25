import { Loader } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./useAuth";

export function AdminRoute() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader className="h-6 w-6 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (status === "unauthenticated" || user === null) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-2xl">Permission denied</p>
      </div>
    );
  }

  return <Outlet />;
}
