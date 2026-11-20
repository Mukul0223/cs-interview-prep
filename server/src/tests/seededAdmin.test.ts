import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearDatabase, createTestUser, prisma } from "./helpers.js";
import { ensureAdmin } from "../services/authService.js";
import { verifyPassword } from "../lib/password.js";

describe("authService.ensureAdmin", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates an ADMIN user with an argon2id password hash", async () => {
    const email = "Admin@Example.com";
    const password = "StrongAdminPassword123";

    const created = await ensureAdmin(email, password);

    expect(created.email).toBe("admin@example.com");
    expect(created.role).toBe("ADMIN");

    const dbUser = await prisma.user.findUnique({
      where: { email: "admin@example.com" },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.role).toBe("ADMIN");
    expect(dbUser!.passwordHash).not.toBe(password);
    expect(dbUser!.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(dbUser!.passwordHash, password)).toBe(true);
  });

  it("is idempotent and does not duplicate the user or change the password", async () => {
    const email = "admin@example.com";
    const initialPassword = "InitialAdminPassword123";

    const first = await ensureAdmin(email, initialPassword);
    const second = await ensureAdmin(
      "ADMIN@example.com",
      "DifferentPassword999",
    );

    expect(second.id).toBe(first.id);
    expect(second.role).toBe("ADMIN");
    expect(second.passwordHash).toBe(first.passwordHash);

    const matchingUsers = await prisma.user.findMany({
      where: { email },
    });
    expect(matchingUsers).toHaveLength(1);
    expect(
      await verifyPassword(matchingUsers[0].passwordHash, initialPassword),
    ).toBe(true);
    expect(
      await verifyPassword(
        matchingUsers[0].passwordHash,
        "DifferentPassword999",
      ),
    ).toBe(false);
  });

  it("promotes an existing USER to ADMIN without changing their password", async () => {
    const email = "existing-user@example.com";
    const originalPassword = "OriginalUserPassword123";

    const existingUser = await createTestUser({
      email,
      password: originalPassword,
      role: "USER",
    });

    const userBefore = await prisma.user.findUnique({
      where: { id: existingUser.id },
    });
    expect(userBefore).not.toBeNull();
    expect(userBefore!.role).toBe("USER");

    const promoted = await ensureAdmin(email, "NewSeedPasswordNotUsed123");

    expect(promoted.id).toBe(existingUser.id);
    expect(promoted.role).toBe("ADMIN");
    expect(promoted.passwordHash).toBe(userBefore!.passwordHash);

    const userAfter = await prisma.user.findUnique({
      where: { id: existingUser.id },
    });
    expect(userAfter).not.toBeNull();
    expect(userAfter!.role).toBe("ADMIN");
    expect(userAfter!.passwordHash).toBe(userBefore!.passwordHash);
    expect(
      await verifyPassword(userAfter!.passwordHash, originalPassword),
    ).toBe(true);
    expect(
      await verifyPassword(
        userAfter!.passwordHash,
        "NewSeedPasswordNotUsed123",
      ),
    ).toBe(false);
  });
});
