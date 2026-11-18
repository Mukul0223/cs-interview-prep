import { it, beforeEach, describe, expect, afterAll } from "vitest";
import {
  clearDatabase,
  loginTestUser,
  extractRefreshCookie,
  prisma,
  postRefresh,
  postLogout,
} from "./helpers.js";
import { verifyAccessToken } from "../lib/tokens.js";

describe("Auth Refresh Token Rotation and Logout Test", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rotates the token and records the audit trail", async () => {
    const { rawToken: tokenA, userId } = await loginTestUser();

    const res = await postRefresh(tokenA);

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
    const res = await postRefresh(undefined);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("malformed cookie gives 401 INVALID_REFRESH_TOKEN", async () => {
    const res = await postRefresh("malformed-refresh-token");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("expired token gives 401 and is not rotated", async () => {
    const { rawToken, userId } = await loginTestUser();
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const res = await postRefresh(rawToken);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    const rows = await prisma.refreshToken.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].revokedAt).toBeNull();
  });

  it("reuse detection: presenting an old rotated token nukes the entire family", async () => {
    const { rawToken: rawTokenA, userId } = await loginTestUser();

    // First refresh: Token A -> Token B
    const res1 = await postRefresh(rawTokenA);
    expect(res1.status).toBe(200);

    const rawTokenB = extractRefreshCookie(res1);

    // Replay Attack: Present Token A AGAIN -> Triggers reuse detection (401)
    const reuseRes = await postRefresh(rawTokenA);
    expect(reuseRes.status).toBe(401);

    // Family Nuke check: Token B must now be rejected as well (401)
    const tokenBRes = await postRefresh(rawTokenB);
    expect(tokenBRes.status).toBe(401);

    const rows = await prisma.refreshToken.findMany({ where: { userId } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.revokedAt !== null)).toBe(true);
  });

  it("user isolation: User 1 reuse event does not affect User 2", async () => {
    const { rawToken: user1Token } = await loginTestUser({
      email: "test1@example.com",
      password: "password12345",
    });
    const { rawToken: user2Token } = await loginTestUser({
      email: "test2@example.com",
      password: "password12345",
    });

    // Trigger a reuse event for User 1
    await postRefresh(user1Token);
    await postRefresh(user1Token); // Replay!

    // User 2 tries to refresh normally -> Should still succeed
    const user2Res = await postRefresh(user2Token);

    expect(user2Res.status).toBe(200);
  });

  it("concurrent refreshes with the same token result in one 200 and one 401", async () => {
    const { rawToken: rawTokenA } = await loginTestUser();

    // Fire two identical refresh requests at the exact same time
    const results = await Promise.all([
      postRefresh(rawTokenA),
      postRefresh(rawTokenA),
    ]);

    const statuses = results.map((r) => r.status).sort();
    // One wins (200), the duplicate fails the atomic count === 0 check (401)
    expect(statuses).toEqual([200, 401]);
  });

  it("incorrect or missing Origin header returns 403", async () => {
    const { rawToken: rawTokenA } = await loginTestUser();

    const res = await postRefresh(rawTokenA, "http://malicious-attacker.com");
    expect(res.status).toBe(403);

    const res1 = await postRefresh(rawTokenA, null);
    expect(res1.status).toBe(403);

    const res2 = await postRefresh(rawTokenA);
    expect(res2.status).toBe(200);
  });

  it("logout clears cookie, revokes row, and blocks subsequent refreshes", async () => {
    const { rawToken: rawTokenA, userId } = await loginTestUser();

    const logoutRes = await postLogout(rawTokenA);

    expect(logoutRes.status).toBe(204);

    const row = await prisma.refreshToken.findFirst({ where: { userId } });
    expect(row!.revokedAt).not.toBeNull();

    const setCookieHeader = logoutRes.headers["set-cookie"];
    expect(setCookieHeader[0]).toMatch(/^refresh_token=;/);
    expect(setCookieHeader[0]).toMatch(/1970/);

    // Trying to refresh with that logged-out token gives 401
    const refreshRes = await postRefresh(rawTokenA);

    expect(refreshRes.status).toBe(401);
  });

  it("logout with no cookie is idempotent and returns 204", async () => {
    const res = await postLogout(undefined);

    expect(res.status).toBe(204);
  });

  it("refresh after database role promotion issues token with ADMIN role", async () => {
    const { rawToken: rawTokenA, userId } = await loginTestUser();

    // Directly promote user to ADMIN in the database
    await prisma.user.update({
      where: { id: userId },
      data: { role: "ADMIN" },
    });

    const res = await postRefresh(rawTokenA);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");

    const decoded = await verifyAccessToken(res.body.accessToken);
    expect(decoded.role).toBe("ADMIN");
  });
});
