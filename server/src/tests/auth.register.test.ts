import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../lib/tokens.js";
import crypto from "crypto";

describe("POST /api/v1/auth/register", () => {
  // Clear tables before every test in correct foreign key order
  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  it("1, 2, 3. successfully registers a user, sets secure cookie, and persists hashed data correctly", async () => {
    const payload = {
      email: "TeSt@ExAmPlE.cOm",
      password: "SecurePassword123!",
      displayName: "Test User",
    };

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send(payload);

    // 1. Check 201 status and response body structure
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("accessToken");
    expect(response.body).toHaveProperty("user");
    expect(response.body.user).toMatchObject({
      email: "test@example.com", // Normalized lowercase email
      displayName: "Test User",
      role: "USER",
    });

    // Security check: passwordHash must never be returned
    expect(response.body).not.toHaveProperty("passwordHash");
    expect(response.body.user).not.toHaveProperty("passwordHash");

    // Verify Access Token validity
    const decodedToken = await verifyAccessToken(response.body.accessToken);
    expect(decodedToken).toBeDefined();

    // 2. Check Set-Cookie header security attributes
    const cookies = response.get("Set-Cookie");
    expect(cookies).toBeDefined();
    const cookieString = cookies![0];
    expect(cookieString).toContain("refresh_token=");
    expect(cookieString).toMatch(/HttpOnly/i);
    expect(cookieString).toMatch(/SameSite=Strict/i);
    expect(cookieString).toMatch(/\/api\/v1\/auth/i);

    // Extract cookie value for database verification
    const cookieMatch = cookieString.match(/refresh_token=([^;]+)/);
    const rawCookieValue = cookieMatch ? cookieMatch[1] : null;
    expect(rawCookieValue).toBeTruthy();

    // 3. Database verification
    const dbUser = await prisma.user.findUnique({
      where: { email: "test@example.com" },
    });
    expect(dbUser).not.toBeNull();
    // Check that password hash uses argon2id
    expect(dbUser!.passwordHash.startsWith("$argon2id$")).toBe(true);
    // Check email normalization
    expect(dbUser!.email).toBe("test@example.com");

    const dbToken = await prisma.refreshToken.findFirst({
      where: { userId: dbUser!.id },
    });
    expect(dbToken).not.toBeNull();
    expect(dbToken!.revokedAt).toBeNull();
    // Token hash stored in DB must NOT equal the raw cookie value, but match its hash
    expect(dbToken!.tokenHash).not.toBe(rawCookieValue);

    const expectedHash = crypto
      .createHash("sha256")
      .update(rawCookieValue!)
      .digest("hex");
    expect(dbToken!.tokenHash).toBe(expectedHash);
  });

  it("4. returns 409 EMAIL_TAKEN when registering with the same email in different case", async () => {
    const payload = {
      email: "user@example.com",
      password: "SecurePassword123!",
      displayName: "First User",
    };

    // Register first user
    await request(app).post("/api/v1/auth/register").send(payload);

    // Attempt to register with mixed/upper case variant
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        ...payload,
        email: "USER@eXaMpLe.CoM",
        displayName: "Second User",
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("5. returns 400 VALIDATION_ERROR for invalid inputs (short password, missing fields, bad email)", async () => {
    // Password too short (9 chars)
    const resShortPwd = await request(app).post("/api/v1/auth/register").send({
      email: "test@example.com",
      password: "short123!",
      displayName: "Test",
    });
    expect(resShortPwd.status).toBe(400);
    expect(resShortPwd.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(resShortPwd.body)).toMatch(/password/i);

    // Invalid email
    const resBadEmail = await request(app).post("/api/v1/auth/register").send({
      email: "not-an-email",
      password: "SecurePassword123!",
      displayName: "Test",
    });
    expect(resBadEmail.status).toBe(400);
    expect(resBadEmail.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(resBadEmail.body)).toMatch(/email/i);

    // Missing displayName
    const resNoName = await request(app).post("/api/v1/auth/register").send({
      email: "test@example.com",
      password: "SecurePassword123!",
    });
    expect(resNoName.status).toBe(400);
    expect(resNoName.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(resNoName.body)).toMatch(/displayName/i);
  });

  it("6. prevents mass assignment by forcing role to USER even if ADMIN is supplied", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      email: "admin@example.com",
      password: "SecurePassword123!",
      displayName: "Hacker",
      role: "ADMIN", // Malicious injection attempt
    });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe("USER");

    // Verify in database as well
    const dbUser = await prisma.user.findUnique({
      where: { email: "admin@example.com" },
    });
    expect(dbUser!.role).toBe("USER");
  });
});
