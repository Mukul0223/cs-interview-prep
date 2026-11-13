import { Role } from "../generated/prisma/enums";
import { hashPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";

export async function clearDatabase() {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

export async function createTestUser(
  overrides: {
    email?: string;
    password?: string;
    displayName?: string;
    role?: Role;
  } = {},
) {
  const plainPassword = overrides.password || "secure_Pass123";
  const passwordHash = await hashPassword(plainPassword);

  return prisma.user.create({
    data: {
      email: (overrides.email || "test@example.com").toLowerCase(),
      passwordHash,
      displayName: overrides.displayName || "Test User",
      role: overrides.role || "USER",
    },
  });
}

export { prisma };
