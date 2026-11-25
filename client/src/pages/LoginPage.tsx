import { useState, type SubmitEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ApiRequestError } from "../api/http";
import { useAuth } from "../auth/useAuth";

type LoginField = "email" | "password";
type FieldErrors = Partial<Record<LoginField, string>>;

function getRedirectPath(state: unknown): string {
  if (state && typeof state === "object" && "from" in state) {
    const from = (state as { from?: unknown }).from;
    if (typeof from === "string" && from.startsWith("/")) {
      return from;
    }
    if (
      from &&
      typeof from === "object" &&
      "pathname" in from &&
      typeof (from as { pathname?: unknown }).pathname === "string"
    ) {
      return (from as { pathname: string }).pathname;
    }
  }
  return "/";
}

function extractFieldErrors<K extends string>(
  err: ApiRequestError,
  allowedKeys: readonly K[],
): Partial<Record<K, string>> {
  const result: Partial<Record<K, string>> = {};
  const errWithDetails = err as ApiRequestError & {
    details?: Record<string, unknown>;
    fields?: Record<string, unknown>;
    errors?: Record<string, unknown>;
  };

  const rawMap =
    errWithDetails.details ?? errWithDetails.fields ?? errWithDetails.errors;

  if (rawMap && typeof rawMap === "object") {
    for (const key of allowedKeys) {
      const val = rawMap[key];
      if (typeof val === "string" && val.trim()) {
        result[key] = val;
      } else if (Array.isArray(val) && typeof val[0] === "string") {
        result[key] = val[0];
      }
    }
  }

  // Fallback if validation details are encoded in err.message (e.g., "password: must be at least 10 characters")
  if (Object.keys(result).length === 0 && err.message) {
    const lowerMsg = err.message.toLowerCase();
    for (const key of allowedKeys) {
      if (lowerMsg.includes(key.toLowerCase())) {
        result[key] = err.message;
      }
    }
  }

  return result;
}

export function LoginPage() {
  const { status, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  if (status !== "loading" && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    setFieldErrors({});

    try {
      await login({ email, password });
      navigate(getRedirectPath(location.state), { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        if (err.code === "INVALID_CREDENTIALS") {
          setFormError(err.message || "Invalid email or password.");
        } else if (err.code === "VALIDATION_ERROR") {
          const mapped = extractFieldErrors(err, [
            "email",
            "password",
          ] as const);
          setFieldErrors(mapped);
          if (Object.keys(mapped).length === 0) {
            setFormError(err.message || "Please check your input.");
          }
        } else {
          setFormError(`${err.status} ${err.code}: ${err.message}`);
        }
      } else if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError(String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center bg-bg p-6 font-sans text-ink">
      <section className="rounded-sm bg-surface p-6">
        <h1 className="text-xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Sign in to continue to your account.
        </p>

        {formError && (
          <div
            role="alert"
            className="mt-4 rounded-sm border border-error bg-bg p-3 text-sm text-error"
          >
            <strong>Error:</strong> {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={busy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={
                fieldErrors.email ? "login-email-error" : undefined
              }
              className="mt-1 block w-full rounded-sm border border-muted bg-bg px-3 py-2 text-base text-ink disabled:opacity-60"
            />
            {fieldErrors.email && (
              <p
                id="login-email-error"
                role="alert"
                className="mt-1 text-sm text-error"
              >
                <strong>Email error:</strong> {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium"
            >
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={busy}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? "login-password-error" : undefined
              }
              className="mt-1 block w-full rounded-sm border border-muted bg-bg px-3 py-2 text-base text-ink disabled:opacity-60"
            />
            {fieldErrors.password && (
              <p
                id="login-password-error"
                role="alert"
                className="mt-1 text-sm text-error"
              >
                <strong>Password error:</strong> {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="rounded-sm bg-accent px-4 py-2 text-base text-bg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-ink underline">
            Register
          </Link>
        </p>
      </section>
    </main>
  );
}
