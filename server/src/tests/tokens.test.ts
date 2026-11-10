import { describe, it, expect, beforeEach } from "vitest";
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "../lib/tokens.js";
import { env } from "../config/env.js";
import { Role } from "../generated/prisma/client.js";
import { SignJWT } from "jose";

describe("Token Management", () => {
  // Ensure a valid secret is present for tests

  it("the token round-trips successfully", async () => {
    const input = { userId: "user-123", role: Role.USER };

    const token = await signAccessToken(input);
    const verified = await verifyAccessToken(token);

    expect(verified.userId).toBe(input.userId);
    expect(verified.role).toBe(input.role);
  });

  it("a tampered token is rejected", async () => {
    const token = await signAccessToken({
      userId: "user-123",
      role: Role.USER,
    });

    // Tamper with the signature payload section
    const tampered = token.slice(0, -5) + "abcde";

    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });

  it("an expired token is rejected", async () => {
    const secret = env.JWT_ACCESS_SECRET!;
    const secretBytes = new TextEncoder().encode(secret);

    // Build an expired token directly using jose with timestamps in the past
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = await new SignJWT({ role: Role.USER })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setIssuedAt(now - 7200) // 2 hours ago
      .setExpirationTime(now - 3600) // 1 hour ago (expired)
      .sign(secretBytes);

    await expect(verifyAccessToken(expiredToken)).rejects.toThrow();
  });

  it("two refresh tokens differ, and the hash is 64 hex characters and not equal to the raw token", () => {
    const token1 = generateRefreshToken();
    const token2 = generateRefreshToken();

    // Ensure generated refresh tokens are unique
    expect(token1).not.toBe(token2);

    const hash = hashRefreshToken(token1);

    // Hash should not equal the raw token
    expect(hash).not.toBe(token1);

    // SHA-256 hex string must be exactly 64 characters long
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(token1)).toBe(hashRefreshToken(token1));
  });
});
