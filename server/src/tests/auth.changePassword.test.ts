import { beforeEach, afterAll, it, describe, expect } from "vitest";
import request from "supertest";
import {
  clearDatabase,
  extractRefreshCookie,
  loginTestUser,
  postRefresh,
  prisma,
} from "./helpers.js";
import { verifyPassword } from "../lib/password.js";
import app from "../app.js";

describe("Change password tests", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("Successful with new cookie, returns 204", async () => {
    const credentials = {
      email: "test1@example.com",
      password: "password12345",
    };
    const newPassword = "PasWord123";

    const { userId, accessToken } = await loginTestUser(credentials);

    const userBefore = await prisma.user.findUnique({
      where: { id: userId },
    });
    expect(userBefore).not.toBeNull();

    const res = await request(app)
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        currentPassword: credentials.password,
        newPassword,
      });

    expect(res.status).toBe(204);
    expect(res.headers["set-cookie"]).toBeDefined();

    const userAfter = await prisma.user.findUnique({
      where: { id: userId },
    });
    expect(userAfter).not.toBeNull();
    expect(userAfter!.passwordHash).not.toBe(userBefore!.passwordHash);
    expect(await verifyPassword(userAfter!.passwordHash, newPassword)).toBe(
      true,
    );

    const activeTokens = await prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
      },
    });
    expect(activeTokens).toHaveLength(1);

    const res1 = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: credentials.email, password: credentials.password });
    expect(res1.status).toBe(401);
    expect(res1.body.error.code).toBe("INVALID_CREDENTIALS"); // verify exact string in your handler

    const res2 = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: credentials.email, password: newPassword });
    expect(res2.status).toBe(200);
    expect(res2.body.user).toMatchObject({
      id: userAfter!.id,
      email: "test1@example.com",
      displayName: "Test1",
      role: "USER",
    });
    expect(res2.body.user).not.toHaveProperty("passwordHash");
  });

  it("Rejects both old refresh tokens when user has two logged-in sessions", async () => {
    const credentials = {
      email: "test1@example.com",
      password: "password12345",
    };
    const newPassword = "PasWord123";

    const session1 = await loginTestUser(credentials);

    const login2Res = await request(app)
      .post("/api/v1/auth/login")
      .send(credentials);
    const session2Token = await extractRefreshCookie(login2Res);

    const oldTokensBefore = await prisma.refreshToken.findMany({
      where: { userId: session1.userId },
    });
    expect(oldTokensBefore).toHaveLength(2);

    const res = await request(app)
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${session1.accessToken}`)
      .send({ currentPassword: credentials.password, newPassword });

    expect(res.status).toBe(204);
    expect(res.headers["set-cookie"]).toBeDefined();

    const revokedTokens = await prisma.refreshToken.findMany({
      where: {
        userId: session1.userId,
        id: { in: oldTokensBefore.map((t) => t.id) },
      },
    });
    expect(revokedTokens).toHaveLength(2);
    for (const token of revokedTokens) {
      expect(token.revokedAt).not.toBeNull();
    }

    const activeTokens = await prisma.refreshToken.findMany({
      where: { userId: session1.userId, revokedAt: null },
    });
    expect(activeTokens).toHaveLength(1);

    const token1 = session1.rawToken;

    const resfresh1 = await postRefresh(token1);
    expect(resfresh1.status).toBe(401);

    const resfresh2 = await postRefresh(session2Token);
    expect(resfresh2.status).toBe(401);
  });

  it("Returns 401 INVALID_CURRENT_PASSWORD and leaves state unchanged on wrong current password", async () => {
    const credentials = {
      email: "test1@example.com",
      password: "password12345",
    };

    const { userId, accessToken, rawToken } = await loginTestUser(credentials);

    const userBefore = await prisma.user.findUnique({
      where: { id: userId },
    });
    expect(userBefore).not.toBeNull();

    const tokensBefore = await prisma.refreshToken.findMany({
      where: { userId },
    });
    expect(tokensBefore).toHaveLength(1);

    const res = await request(app)
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        currentPassword: "wrongPassword999",
        newPassword: "NewPassword123",
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CURRENT_PASSWORD");

    const userAfter = await prisma.user.findUnique({
      where: { id: userId },
    });
    expect(userAfter).not.toBeNull();
    expect(userAfter!.passwordHash).toBe(userBefore!.passwordHash);

    const tokensAfter = await prisma.refreshToken.findMany({
      where: { userId },
    });
    expect(tokensAfter).toHaveLength(tokensBefore.length);
    expect(tokensAfter.every((t) => t.revokedAt === null)).toBe(true);

    const refreshRes = await postRefresh(rawToken);
    expect(refreshRes.status).toBe(200);
  });

  it("Returns 400 for a short new password", async () => {
    const credentials = {
      email: "test1@example.com",
      password: "password12345",
    };

    const { accessToken } = await loginTestUser(credentials);

    const res = await request(app)
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        currentPassword: credentials.password,
        newPassword: "short",
      });

    expect(res.status).toBe(400);
  });

  it("Returns 401 UNAUTHENTICATED when no token is provided", async () => {
    const res = await request(app).post("/api/v1/auth/change-password").send({
      currentPassword: "password12345",
      newPassword: "NewPassword123",
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("Leaves another user's refresh tokens unaffected", async () => {
    const user1Credentials = {
      email: "test1@example.com",
      password: "password12345",
    };
    const user2Credentials = {
      email: "test2@example.com",
      password: "password12345",
    };

    const user1 = await loginTestUser(user1Credentials);
    const user2 = await loginTestUser(user2Credentials);

    const res = await request(app)
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${user1.accessToken}`)
      .send({
        currentPassword: user1Credentials.password,
        newPassword: "NewPassword123",
      });

    expect(res.status).toBe(204);

    const user2Tokens = await prisma.refreshToken.findMany({
      where: { userId: user2.userId },
    });
    expect(user2Tokens).toHaveLength(1);
    expect(user2Tokens[0].revokedAt).toBeNull();

    const user2Refresh = await postRefresh(user2.rawToken);
    expect(user2Refresh.status).toBe(200);
  });
});
