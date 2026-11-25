import { useAuth } from "../auth/useAuth";

export function ProfilePage() {
  const { user, logout } = useAuth();

  return (
    <main className="mx-auto max-w-2xl bg-bg p-6 font-sans text-ink">
      <h1 className="text-2xl font-bold">Profile</h1>
      <pre className="mt-4 overflow-x-auto rounded-sm bg-surface p-4 text-sm text-ink">
        {JSON.stringify(user, null, 2)}
      </pre>
      {logout && (
        <button
          onClick={logout}
          className="mt-4 rounded-sm bg-accent px-4 py-2 text-base text-bg"
        >
          Log out
        </button>
      )}
    </main>
  );
}
