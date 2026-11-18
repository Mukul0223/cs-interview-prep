import { it, beforeEach, describe, expect, afterAll } from "vitest";
import app from "../app.js";
import request from "supertest";
import {
  clearDatabase,
  getAuthCookie,
  extractRefreshCookie,
  prisma,
} from "./helpers.js";
import { env } from "../config/env.js";
import { verifyAccessToken } from "../lib/tokens.js";

describe("Auth Refresh Token Rotation and Logout Test", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rotates the token and records the audit trail", async () => {
    const { rawToken: tokenA, userId } = await getAuthCookie();

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${tokenA}`)
      .set("Origin", env.CORS_ORIGIN);

    expect(res.status).toBe(200);
    const decoded = await verifyAccessToken(res.body.accessToken);
    expect(decoded.userId).toBe(userId);
    expect(extractRefreshCookie(res)).not.toBe(tokenA);

    const rows = await prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    expect(rows).toHaveLength(2);
    const [oldRow, newRow] = rows;
    expect(oldRow.revokedAt).not.toBeNull();
    expect(oldRow.replacedByTokenId).toBe(newRow.id);
    expect(newRow.revokedAt).toBeNull();
    expect(newRow.familyId).toBe(oldRow.familyId);
  });

  it("missing cookies gives 401 INVALID_REFRESH_TOKEN", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", env.CORS_ORIGIN);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("malformed cookie gives 401 INVALID_REFRESH_TOKEN", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", "refresh_token=malformed-refresh-token")
      .set("Origin", env.CORS_ORIGIN);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("expired token gives 401 and is not rotated", async () => {
    const { rawToken, userId } = await getAuthCookie();
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawToken}`)
      .set("Origin", env.CORS_ORIGIN);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    const rows = await prisma.refreshToken.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].revokedAt).toBeNull();
  });

  //// ==========================================
  // 4. TOKEN REUSE / FAMILY NUKE
  // ==========================================
  it("4. Reuse detection: presenting an old rotated token nukes the entire family", async () => {
    const { rawToken: rawTokenA, userId } = await getAuthCookie();

    // First refresh: Token A -> Token B
    const res1 = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawTokenA}`)
      .set("Origin", env.CORS_ORIGIN);
    expect(res1.status).toBe(200);

    const rawTokenB = extractRefreshCookie(res1);

    // Replay Attack: Present Token A AGAIN -> Triggers reuse detection (401)
    const reuseRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawTokenA}`)
      .set("Origin", env.CORS_ORIGIN);
    expect(reuseRes.status).toBe(401);

    // Family Nuke check: Token B must now be rejected as well (401)
    const tokenBRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawTokenB}`)
      .set("Origin", env.CORS_ORIGIN);
    expect(tokenBRes.status).toBe(401);

    const rows = await prisma.refreshToken.findMany({ where: { userId } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.revokedAt !== null)).toBe(true);
  });

  // ==========================================
  // 5. USER ISOLATION
  // ==========================================
  it("5. User isolation: User 1 reuse event does not affect User 2", async () => {
    // Log in two different test users (ensure both exist in your test seed/DB)
    const { rawToken: user1Token } = await getAuthCookie({
      email: "test1@example.com",
      password: "password12345",
    });
    const { rawToken: user2Token } = await getAuthCookie({
      email: "test2@example.com",
      password: "password12345",
    });

    // Trigger a reuse event for User 1
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${user1Token}`)
      .set("Origin", env.CORS_ORIGIN);
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${user1Token}`)
      .set("Origin", env.CORS_ORIGIN); // Replay!

    // User 2 tries to refresh normally -> Should still succeed
    const user2Res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${user2Token}`)
      .set("Origin", env.CORS_ORIGIN);

    expect(user2Res.status).toBe(200);
  });

  // ==========================================
  // 6. RACE CONDITIONS (CONCURRENCY)
  // ==========================================
  it("6. Concurrent refreshes with the same token result in one 200 and one 401", async () => {
    const { rawToken: rawTokenA } = await getAuthCookie();

    // Fire two identical refresh requests at the exact same time
    const results = await Promise.all([
      request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", `refresh_token=${rawTokenA}`)
        .set("Origin", env.CORS_ORIGIN),
      request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", `refresh_token=${rawTokenA}`)
        .set("Origin", env.CORS_ORIGIN),
    ]);

    const statuses = results.map((r) => r.status).sort();
    // One wins (200), the duplicate fails the atomic count === 0 check (401)
    expect(statuses).toEqual([200, 401]);
  });

  // ==========================================
  // 7. ORIGIN VALIDATION (CSRF)
  // ==========================================
  it("7. Incorrect or missing Origin header returns 403", async () => {
    const { rawToken: rawTokenA } = await getAuthCookie();

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawTokenA}`)
      .set("Origin", "http://malicious-attacker.com");

    expect(res.status).toBe(403);

    const res1 = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawTokenA}`);

    expect(res1.status).toBe(403);

    const res2 = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawTokenA}`)
      .set("Origin", env.CORS_ORIGIN);
    expect(res2.status).toBe(200);
  });

  // ==========================================
  // 8. LOGOUT LIFECYCLE & IDEMPOTENCY
  // ==========================================
  it("8a. Logout clears cookie, revokes row, and blocks subsequent refreshes", async () => {
    const { rawToken: rawTokenA, userId } = await getAuthCookie();

    const logoutRes = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", `refresh_token=${rawTokenA}`)
      .set("Origin", env.CORS_ORIGIN);

    expect(logoutRes.status).toBe(204);

    const row = await prisma.refreshToken.findFirst({ where: { userId } });
    expect(row!.revokedAt).not.toBeNull();
    // Verify cookie was cleared (expires header set to past date)
    const setCookieHeader = logoutRes.headers["set-cookie"];
    expect(setCookieHeader[0]).toMatch(/^refresh_token=;/);
    expect(setCookieHeader[0]).toMatch(/1970/);

    // Trying to refresh with that logged-out token gives 401
    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawTokenA}`)
      .set("Origin", env.CORS_ORIGIN);

    expect(refreshRes.status).toBe(401);
  });

  it("8b. Logout with no cookie is idempotent and returns 204", async () => {
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", env.CORS_ORIGIN); // No cookie provided

    expect(res.status).toBe(204);
  });

  // ==========================================
  // 9. ROLE HOT-RELOADING
  // ==========================================
  it("9. Refresh after database role promotion issues token with ADMIN role", async () => {
    const { rawToken: rawTokenA, userId } = await getAuthCookie();

    // Directly promote user to ADMIN in the database
    await prisma.user.update({
      where: { id: userId },
      data: { role: "ADMIN" },
    });

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawTokenA}`)
      .set("Origin", env.CORS_ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");

    const decoded = await verifyAccessToken(res.body.accessToken);
    expect(decoded.role).toBe("ADMIN");
  });
});
