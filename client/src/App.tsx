import { useState, type SubmitEvent } from "react";
import { getMe } from "./api/auth";
import { ApiRequestError, setAccessToken } from "./api/http";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/useAuth";

function DevAuthPanel() {
  const { status, user, login, logout } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string>("");

  async function handleLogin(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setOutput("");
    try {
      const loggedInUser = await login({ email, password });
      setPassword("");
      setOutput(`Logged in as ${loggedInUser.email}`);
    } catch (err) {
      setOutput(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setOutput("");
    try {
      await logout();
      setOutput("Logged out");
    } catch (err) {
      setOutput(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCallMeWithBrokenToken() {
    setBusy(true);
    setOutput("");
    setAccessToken("bad");
    try {
      const me = await getMe();
      setOutput(`GET /me succeeded: ${JSON.stringify(me)}`);
    } catch (err) {
      setOutput(`GET /me failed: ${formatError(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="m-4 max-w-lg rounded-lg border-2 border-dashed border-amber-500 bg-amber-50/40 p-4 font-sans text-sm text-slate-900">
      <p className="mb-3 font-bold text-amber-800">
        TEMPORARY DEV AUTH PANEL (remove before production)
      </p>

      <p className="mb-3 text-slate-700">
        <span className="font-semibold text-slate-900">Status:</span> {status} |{" "}
        <span className="font-semibold text-slate-900">User:</span>{" "}
        {user ? `${user.displayName} (${user.email}, ${user.role})` : "null"}
      </p>

      <form onSubmit={handleLogin} className="mb-3 flex flex-wrap gap-2">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={busy}
          className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:outline-none disabled:opacity-50"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={busy}
          className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Login
        </button>
        <button
          type="button"
          onClick={handleLogout}
          disabled={busy}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Logout
        </button>
      </form>

      <button
        type="button"
        onClick={handleCallMeWithBrokenToken}
        disabled={busy}
        className="rounded bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Call /me with a broken token
      </button>

      {output && (
        <pre className="mt-3 overflow-x-auto rounded bg-slate-900 p-2.5 font-mono text-xs whitespace-pre-wrap wrap-break-words text-slate-50">
          {output}
        </pre>
      )}
    </section>
  );
}

function formatError(err: unknown): string {
  if (err instanceof ApiRequestError) {
    return `${err.status} ${err.code}: ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export function App() {
  return (
    <AuthProvider>
      <main className="min-h-screen bg-white">
        <DevAuthPanel />
      </main>
    </AuthProvider>
  );
}

export default App;
