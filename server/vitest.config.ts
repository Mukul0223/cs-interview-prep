import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      CORS_ORIGIN: "http://localhost:5173",
      JWT_ACCESS_SECRET:
        "1f37ddb1cc1efdbb2de28da089e18b480fe9ad8927308f790a9b9d774e865602",
    },
    exclude: ["dist/**", "node_modules/**"],
  },
});
