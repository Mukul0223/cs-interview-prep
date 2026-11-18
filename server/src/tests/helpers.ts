import request, { type Response } from "supertest";
import type { Role } from "../generated/prisma/enums.js";
import { hashPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import app from "../app.js";
import { env } from "../config/env.js";

export async function clearDatabase() {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

export async function createTestUser(
  overrides: {
    email?: string;
    password?: string;
    displayName?: string;
    role?: Role;
  } = {},
) {
  const plainPassword = overrides.password || "secure_Pass123";
  const passwordHash = await hashPassword(plainPassword);

  return prisma.user.create({
    data: {
      email: (overrides.email || "test@example.com").toLowerCase(),
      passwordHash,
      displayName: overrides.displayName || "Test User",
      role: overrides.role || "USER",
    },
  });
}

export function extractRefreshCookie(res: Response): string {
  const header = res.headers["set-cookie"];
  const list = Array.isArray(header) ? header : header ? [header] : [];
  const line = list.find((c: string) => c.startsWith("refresh_token="));
  const match = line?.match(/refresh_token=([^;]+)/);
  if (!match?.[1]) throw new Error("refresh_token cookie not found");
  return match[1];
}

export async function getAuthCookie(
  credentials = {
    email: "test1@example.com",
    password: "password12345",
  },
) {
  const user = await createTestUser({
    email: credentials.email,
    password: credentials.password,
    displayName: "Test1",
  });

  const response = await request(app)
    .post("/api/v1/auth/login")
    .send(credentials)
    .set("Origin", env.CORS_ORIGIN);

  return { rawToken: extractRefreshCookie(response), userId: user.id };
}

export { prisma };
