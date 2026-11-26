import { useState, type SubmitEvent } from "react";
import { Link, Navigate } from "react-router";
import { ApiRequestError } from "../api/http";
import { useAuth } from "../auth/useAuth";
import { getFieldErrors } from "../api/fieldErrors";

type RegisterField = "email" | "displayName" | "password";
type RegisterFieldErrors = Partial<Record<RegisterField, string>>;

export function RegisterPage() {
  const { status, user, register } = useAuth();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});

  if (status !== "loading" && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await register({ email, displayName, password });
      await register({ email, displayName, password });
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        if (err.code === "EMAIL_TAKEN") {
          setFieldErrors({
            email: err.message || "Email is already taken.",
          });
        } else if (err.code === "VALIDATION_ERROR") {
          const mapped = getFieldErrors(err, [
            "email",
            "displayName",
            "password",
          ] as const);
          setFieldErrors(mapped);
          if (Object.keys(mapped).length === 0) {
            setFormError(
              err.message || "Please check your registration details.",
            );
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

  const passwordDescribedBy = fieldErrors.password
    ? "register-password-hint register-password-error"
    : "register-password-hint";

  return (
    <div className="mx-auto max-w-md py-8">
      <section className="rounded-sm bg-surface p-6">
        <h1 className="text-xl font-bold">Register</h1>
        <p className="mt-1 text-sm text-muted">
          Create an account with your email, display name, and password.
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
            <label
              htmlFor="register-email"
              className="block text-sm font-medium"
            >
              Email
            </label>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={busy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={
                fieldErrors.email ? "register-email-error" : undefined
              }
              className="mt-1 block w-full rounded-sm border border-muted bg-bg px-3 py-2 text-base text-ink disabled:opacity-60"
            />
            {fieldErrors.email && (
              <p
                id="register-email-error"
                role="alert"
                className="mt-1 text-sm text-error"
              >
                <strong>Email error:</strong> {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="register-display-name"
              className="block text-sm font-medium"
            >
              Display name
            </label>
            <input
              id="register-display-name"
              name="displayName"
              type="text"
              autoComplete="name"
              required
              disabled={busy}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.displayName)}
              aria-describedby={
                fieldErrors.displayName
                  ? "register-display-name-error"
                  : undefined
              }
              className="mt-1 block w-full rounded-sm border border-muted bg-bg px-3 py-2 text-base text-ink disabled:opacity-60"
            />
            {fieldErrors.displayName && (
              <p
                id="register-display-name-error"
                role="alert"
                className="mt-1 text-sm text-error"
              >
                <strong>Display name error:</strong> {fieldErrors.displayName}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="block text-sm font-medium"
            >
              Password
            </label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              disabled={busy}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={passwordDescribedBy}
              className="mt-1 block w-full rounded-sm border border-muted bg-bg px-3 py-2 text-base text-ink disabled:opacity-60"
            />
            <p id="register-password-hint" className="mt-1 text-sm text-muted">
              at least 10 characters
            </p>
            {fieldErrors.password && (
              <p
                id="register-password-error"
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
            {busy ? "Registering..." : "Register"}
          </button>
        </form>

        <p className="mt-4 text-sm text-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-ink underline">
            Sign in
          </Link>
        </p>
      </section>
    </div>
  );
}
