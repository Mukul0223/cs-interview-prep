import { useAuth } from "../auth/useAuth";

export function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Profile</h1>
      {user && (
        <dl className="mt-4 space-y-3 rounded-sm bg-surface p-4 text-sm">
          <div>
            <dt className="font-medium text-muted">Display name</dt>
            <dd>{user.displayName}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted">Role</dt>
            <dd>{user.role}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
