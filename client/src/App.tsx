import { useState, useEffect } from "react";

export default function App() {
  const [apiStatus, setApiStatus] = useState<string>("Checking API...");

  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/health`,
        );

        if (!response.ok) {
          setApiStatus("API unreachable");
          return;
        }

        const contentType = response.headers.get("content-type");
        let isOK = false;

        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data.status === "ok") {
            isOK = true;
          }
        } else {
          const text = await response.json();
          if (text.trim() === "ok") {
            isOK = true;
          }
        }
        setApiStatus(isOK ? "API ok" : "API unreachable");
      } catch (err) {
        setApiStatus("API unreachable");
      }
    };
    checkApiHealth();
  }, []);

  const getBadgesStyles = () => {
    if (apiStatus === "Checking API")
      return "bg-amber-100 text-amber-800 border-amber-300";
    if (apiStatus === "API ok")
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    return "bg-rose-100 text-rose-800 border-rose-300";
  };

  return <div className={`${getBadgesStyles}`}>{apiStatus}</div>;
}
