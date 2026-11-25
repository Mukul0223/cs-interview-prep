import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg p-6 font-sans text-ink">
      <h1 className="text-2xl font-bold">404 — Not Found</h1>
      <Link
        to="/"
        className="mt-4 rounded-sm bg-accent px-4 py-2 text-base text-bg"
      >
        Back to Home
      </Link>
    </main>
  );
}
