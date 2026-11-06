import { existsSync } from "node:fs";
import * as z from "zod";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.url(),
  CORS_ORIGIN: z.url().transform((v) => new URL(v).origin),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(7),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Configuration validation failed for environment variables:");
  for (const issue of result.error.issues) {
    const variableName = issue.path.join(".");
    console.error(` - ${variableName}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = Object.freeze(result.data);
