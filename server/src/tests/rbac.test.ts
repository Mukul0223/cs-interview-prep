import express from "express";
import request from "supertest";
import { beforeEach, afterAll, describe, expect, it } from "vitest";
import {
  clearDatabase,
  createTestUser,
  loginTestUser,
  prisma,
} from "./helpers.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { signAccessToken } from "../lib/tokens.js";
import { errorHandler } from "../middleware/errorHandler.js";

function createTestApp() {
  const app = express();
  app.use(express.json());

  app.get("/admin-only", requireAuth, requireRole("ADMIN"), (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe("RBAC requireRole middleware", () => {
  const app = createTestApp();

  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).get("/admin-only");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 for a USER token", async () => {
    const credentails = {
      email: "user@example.com",
      password: "password12345",
    };
    const { accessToken } = await loginTestUser(credentails, "USER");

    const res = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 200 for an ADMIN token", async () => {
    const credentails = {
      email: "user@example.com",
      password: "password12345",
    };

    const { accessToken } = await loginTestUser(credentails, "ADMIN");

    const res = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns 403 when token role is ADMIN but user is demoted to USER in DB", async () => {
    const credentails = {
      email: "user@example.com",
      password: "password12345",
    };

    const user = await createTestUser({
      email: credentails.email,
      password: credentails.password,
      role: "ADMIN",
    });

    // Token minted while user has ADMIN role (or with role: "ADMIN" claim)
    const staleAdminToken = await signAccessToken({
      userId: user.id,
      role: "ADMIN",
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { role: "USER" },
    });

    const res = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${staleAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 200 when token role is USER but user is promoted to ADMIN in DB", async () => {
    const user = await createTestUser({
      email: "promoted@example.com",
      password: "password12345",
      role: "USER",
    });

    // Token minted while user has USER role (or with role: "USER" claim)
    const staleUserToken = await signAccessToken({
      userId: user.id,
      role: "USER",
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });

    const res = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${staleUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns 401 for a valid token belonging to a deleted user", async () => {
    const credentails = {
      email: "user@example.com",
      password: "password12345",
    };

    const { userId, accessToken } = await loginTestUser(credentails, "ADMIN");

    await prisma.user.delete({
      where: { id: userId },
    });

    const res = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
