import { defineConfig } from "vitest/config";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

function getDatabaseName(
  urlString: string | undefined,
  varName: string,
): string {
  if (!urlString) {
    throw new Error(`Missing ${varName}`);
  }
  try {
    const parsed = new URL(urlString);
    return parsed.pathname.slice(1);
  } catch {
    throw new Error(`${varName} is not a valid URL`);
  }
}

const testDbName = getDatabaseName(
  process.env.TEST_DATABASE_URL,
  "TEST_DATABASE_URL",
);
const mainDbName = getDatabaseName(process.env.DATABASE_URL, "DATABASE_URL");

if (testDbName === mainDbName) {
  throw new Error("Test database url cannot be same as the main database url");
}
if (!testDbName.toLowerCase().includes("test")) {
  throw new Error("Invalid test_database_url");
}

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      CORS_ORIGIN: "http://localhost:5173",
      JWT_ACCESS_SECRET:
        "1f37ddb1cc1efdbb2de28da089e18b480fe9ad8927308f790a9b9d774e865602",
    },
    exclude: ["dist/**", "node_modules/**"],
    fileParallelism: false,
    globalSetup: ["./vitest.global-setup.ts"],
  },
});
