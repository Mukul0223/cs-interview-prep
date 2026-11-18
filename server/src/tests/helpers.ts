import request from "supertest";
import { Role } from "../generated/prisma/enums";
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

export async function getAuthCookie(
  credentials = {
    email: "test1@example.com",
    password: "password12345",
  },
) {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send(credentials)
    .set("Origin", env.CORS_ORIGIN);

  const cookies = response.headers["set-cookie"];
  if (!cookies || cookies.length === 0) {
    throw new Error("Login failed. No set-cookie header returned from server");
  }

  const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
  const rawCookieString = cookieArray.find((c: string) =>
    c.startsWith("refresh_token="),
  );
  if (!rawCookieString) {
    throw new Error("refresh_token cookie not found in set-cookie headers");
  }

  const match = rawCookieString.match(/refresh_token=([^;]+)/);
  if (!match || !match[1]) {
    throw new Error("Failed to parse refresh_token value from cookie string");
  }

  return match[1];
}

export { prisma };
