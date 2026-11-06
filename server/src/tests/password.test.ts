import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../lib/password.js";

describe("Password Hashing & Verification", () => {
  it("hash isn't the plain password and contains $argon2id$", async () => {
    const plain = "SuperSecretPassword123!";
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash).toContain("$argon2id$");
  });

  it("hashing the same password twice gives different hashes, and verify works for right and wrong passwords", async () => {
    const plain = "SuperSecretPassword123!";

    // Hashing twice should yield different hashes due to unique auto-generated salts
    const hash1 = await hashPassword(plain);
    const hash2 = await hashPassword(plain);
    expect(hash1).not.toBe(hash2);

    // Verify correct password matches both hashes
    expect(await verifyPassword(hash1, plain)).toBe(true);
    expect(await verifyPassword(hash2, plain)).toBe(true);

    // Verify incorrect password fails
    expect(await verifyPassword(hash1, "WrongPassword")).toBe(false);

    // Verify malformed hash returns false instead of throwing
    expect(await verifyPassword("malformed_hash_string", plain)).toBe(false);
  });
});
