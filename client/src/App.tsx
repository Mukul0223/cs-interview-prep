import { useState, useEffect } from "react";

type Status = "checking" | "ok" | "unreachable";

const STATUS_CONFIG: Record<Status, { text: string; style: string }> = {
  checking: {
    text: "Checking API...",
    style: "bg-amber-100 text-amber-800 border-amber-300",
  },
  ok: {
    text: "API ok",
    style: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  unreachable: {
    text: "API unreachable",
    style: "bg-rose-100 text-rose-800 border-rose-300",
  },
};

export default function App() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
        const response = await fetch(`${baseUrl}/health`);

        if (!response.ok) {
          setStatus("unreachable");
          return;
        }

        const data = await response.json();
        setStatus(data.status === "ok" ? "ok" : "unreachable");
      } catch {
        setStatus("unreachable");
      }
    };

    checkApiHealth();
  }, []);

  const { text, style } = STATUS_CONFIG[status];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-900 px-4">
      <div className="w-full max-w-md p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
        <h1 className="text-xl font-bold mb-6 tracking-tight text-slate-800">
          System Status Dashboard
        </h1>

        <div
          className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium border ${style}`}
        >
          {status === "checking" && (
            <svg
              className="motion-safe:animate-spin -ml-1 mr-2 h-4 w-4 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {text}
        </div>
      </div>
    </div>
  );
}
