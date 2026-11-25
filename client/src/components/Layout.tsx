import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router";
import { useAuth } from "../auth/useAuth";

export function Layout() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      try {
        await logout();
      } catch {
        // Local session is already cleared; the server-side token expires on its own
      }
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  const isAuthenticated = status === "authenticated" && user !== null;
  const isAdmin = isAuthenticated && user.role === "ADMIN";

  return (
    <div className="flex min-h-screen flex-col bg-bg font-sans text-base text-ink">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight text-ink transition-colors hover:text-accent"
          >
            CS Interview Prep
          </Link>

          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-3 sm:gap-5"
          >
            {isAdmin && (
              <Link
                to="/admin"
                className="rounded-sm bg-accent/10 px-2.5 py-1 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
              >
                Admin
              </Link>
            )}

            {status === "loading" ? (
              <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className="h-5 w-24 animate-pulse rounded-sm bg-ink/10"
              >
                <span className="sr-only">Checking session</span>
              </div>
            ) : isAuthenticated ? (
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="max-w-35 truncate text-sm font-medium text-ink sm:max-w-xs">
                  {user.displayName}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="cursor-pointer rounded-sm border border-ink/20 bg-bg px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loggingOut ? "Logging out..." : "Log out"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  to="/login"
                  className="rounded-sm px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="rounded-sm bg-accent px-3.5 py-1.5 text-sm font-medium text-bg transition-colors hover:bg-accent/90"
                >
                  Register
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-ink/10 bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:px-6 lg:px-8">
          <p>
            &copy; {new Date().getFullYear()} CS Interview Prep. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
