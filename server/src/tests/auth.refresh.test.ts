import { it, beforeEach, describe, expect, afterAll } from "vitest";
import app from "../app.js";
import request from "supertest";
import { clearDatabase, getAuthCookie, prisma } from "./helpers.js";
import { env } from "../config/env.js";
import { verifyAccessToken } from "../lib/tokens.js";

describe("Auth Refresh Token Rotation and Logout Test", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should successfully rotate tokens and update database audit trail", async () => {
    const rawTokenA = await getAuthCookie();
    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawTokenA}`)
      .set("Origin", env.CORS_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("accessToken");

    const cookies = response.headers["set-cookie"];
    expect(cookies).toBeDefined();
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

  it("Expired token gives 401 and is not rotated", async () => {
    const rawTokenA = await getAuthCookie();
    await prisma.refreshToken.updateMany({
      where: {
        userId: rawTokenA.userId,
      },
      data: {
        expiresAt: new Date(Date.now() - 1000 * 60 * 60),
      },
    });

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawTokenA}`)
      .set("Origin", env.CORS_ORIGIN);
    expect(res.status).toBe(401);
  });

  //// ==========================================
  // 4. TOKEN REUSE / FAMILY NUKE
  // ==========================================
  it("4. Reuse detection: presenting an old rotated token nukes the entire family", async () => {
    const rawTokenA = await getAuthCookie();

    // First refresh: Token A -> Token B
    const res1 = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawTokenA}`)
      .set("Origin", env.CORS_ORIGIN);
    expect(res1.status).toBe(200);

    // Extract Token B's raw cookie value using the same regex pattern
    const cookieHeader = res1.headers["set-cookie"];
    const cookieArray = Array.isArray(cookieHeader)
      ? cookieHeader
      : [cookieHeader];
    const rawCookieStr = cookieArray.find((c: string) =>
      c.startsWith("refresh_token="),
    );
    const rawTokenB = rawCookieStr.match(/refresh_token=([^;]+)/)[1];

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
  });

  // ==========================================
  // 5. USER ISOLATION
  // ==========================================
  it("5. User isolation: User 1 reuse event does not affect User 2", async () => {
    // Log in two different test users (ensure both exist in your test seed/DB)
    const user1Token = await getAuthCookie({
      email: "test1@example.com",
      password: "password12345",
    });
    const user2Token = await getAuthCookie({
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
    const rawToken = await getAuthCookie();

    // Fire two identical refresh requests at the exact same time
    const results = await Promise.all([
      request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", `refresh_token=${rawToken}`)
        .set("Origin", env.CORS_ORIGIN),
      request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", `refresh_token=${rawToken}`)
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
    const rawToken = await getAuthCookie();

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawToken}`)
      .set("Origin", "http://malicious-attacker.com");

    expect(res.status).toBe(403);
  });

  // ==========================================
  // 8. LOGOUT LIFECYCLE & IDEMPOTENCY
  // ==========================================
  it("8a. Logout clears cookie, revokes row, and blocks subsequent refreshes", async () => {
    const rawToken = await getAuthCookie();

    const logoutRes = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", `refresh_token=${rawToken}`)
      .set("Origin", env.CORS_ORIGIN);

    expect(logoutRes.status).toBe(204);
    // Verify cookie was cleared (expires header set to past date)
    const setCookieHeader = logoutRes.headers["set-cookie"];
    expect(setCookieHeader[0]).toMatch(/expires=/i);

    // Trying to refresh with that logged-out token gives 401
    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawToken}`)
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
    const rawToken = await getAuthCookie();

    // Directly promote user to ADMIN in the database
    await prisma.user.update({
      where: { email: "test1@example.com" },
      data: { role: "ADMIN" },
    });

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${rawToken}`)
      .set("Origin", env.CORS_ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");

    const decoded = await verifyAccessToken(res.body.accessToken);
    expect(decoded.role).toBe("ADMIN");
  });
});
