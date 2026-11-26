import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center py-16">
      <h1 className="text-2xl font-bold">404 — Not Found</h1>
      <Link
        to="/"
        className="mt-4 rounded-sm bg-accent px-4 py-2 text-base text-bg"
      >
        Back to Home
      </Link>
    </div>
  );
}
