import request from "supertest";
import app from "../app.js";
import { clearDatabase, createTestUser, prisma } from "./helpers.js";
import { it, describe, afterAll, beforeEach, expect } from "vitest";
import { signAccessToken } from "../lib/tokens.js";
import { SignJWT } from "jose";
import { env } from "../config/env.js";

describe("Login & /me Endpoints", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should login successfully, return 200 cookie and exactly one refresh token row", async () => {
    const password = "Paswword124!";
    await createTestUser({ email: "login@example.com", password });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "login@example.com", password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("user");
    expect(res.headers["set-cookie"]).toBeDefined();

    const refreshTokens = await prisma.refreshToken.findMany();
    expect(refreshTokens).toHaveLength(1);
  });

  it("should return identical 401 INVALID_CREDENTIALS for wrong password and unknown email", async () => {
    await createTestUser({
      email: "login@example.com",
      password: "WrongPassword!",
    });

    const resWrongPass = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "login@example.com", password: "CorrectPassword!" });

    const resUnknown = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "unknown@example.com", password: "WrongPassword!" });

    expect(resWrongPass.status).toBe(401);
    expect(resWrongPass.body.error.code).toBe("INVALID_CREDENTIALS");

    expect(resUnknown.status).toBe(401);
    expect(resUnknown.body).toEqual(resWrongPass.body);
  });

  it("should allow login with a mixed-case email", async () => {
    // Note: ensure createTestUser lowers the email internally so it matches login lookup
    await createTestUser({
      email: "Test.User@example.com",
      password: "Password123!",
    });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "tEsT.UsER@EXAMPLE.cOm", password: "Password123!" });

    expect(res.status).toBe(200);
  });

  it("should return 400 if password is missing", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(400);
  });

  it("should return 200 and user fields without passwordHash on /me", async () => {
    const user = await createTestUser({ email: "me@example.com" });
    const accessToken = await signAccessToken({
      userId: user.id,
      role: user.role,
    });

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: user.id,
      email: "me@example.com",
      displayName: "Test User",
      role: "USER",
    });
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  // --- /ME REJECTIONS ---
  describe("/me rejections", () => {
    it("should return 401 UNAUTHENTICATED with error code for missing, malformed, or tampered tokens", async () => {
      // 1. No header
      const r1 = await request(app).get("/api/v1/auth/me");
      expect(r1.status).toBe(401);
      expect(r1.body.error.code).toBe("UNAUTHENTICATED");

      // 2. Malformed header (Bearer alone)
      const r2 = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer");
      expect(r2.status).toBe(401);
      expect(r2.body.error.code).toBe("UNAUTHENTICATED");

      // 3. Malformed header (Basic abc)
      const r3 = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Basic abc");
      expect(r3.status).toBe(401);
      expect(r3.body.error.code).toBe("UNAUTHENTICATED");

      // 4. Tampered token
      const r4 = await request(app)
        .get("/api/v1/auth/me")
        .set(
          "Authorization",
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered",
        );
      expect(r4.status).toBe(401);
      expect(r4.body.error.code).toBe("UNAUTHENTICATED");
    });

    it("should return 401 for an expired token", async () => {
      const user = await createTestUser();
      const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

      const expiredToken = await new SignJWT({ role: "USER" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60) // 60 seconds in the past
        .sign(secret);

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    });

    it("should return 200 for a token with a future expiry (control case)", async () => {
      const user = await createTestUser();
      const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

      const validToken = await new SignJWT({ role: "USER" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setExpirationTime(Math.floor(Date.now() / 1000) + 300) // 5 minutes in the future
        .sign(secret);

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(user.id);
    });
  });

  // --- LIVE ROLE CHECK ---
  it("should reflect live database role changes in /me even if the token says USER", async () => {
    const user = await createTestUser({ role: "USER" });

    // Issue token while role is USER using the proper helper
    const token = await signAccessToken({ userId: user.id, role: "USER" });

    // Directly update the user's role to ADMIN in the database
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });

    // Call /me
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Because /me queries the database fresh using req.auth.userId, it should report ADMIN
    expect(res.body.user.role).toBe("ADMIN");
  });
});
