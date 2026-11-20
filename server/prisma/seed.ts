import { existsSync } from "node:fs";
import * as z from "zod";
import { prisma } from "../src/lib/prisma.js";
import { ensureAdmin } from "../src/services/authService.js";
import { logger, errorFields } from "../src/lib/logger.js";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const seedEnvSchema = z.object({
  ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  ADMIN_PASSWORD: z.string().min(1).max(128),
});

async function main() {
  const parsed = seedEnvSchema.safeParse({
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  });

  if (!parsed.success) {
    logger.error("Invalid seed environment variables", {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    process.exitCode = 1;
    return;
  }

  const { ADMIN_EMAIL, ADMIN_PASSWORD } = parsed.data;

  const userExists = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, role: true },
  });

  const user = await ensureAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);

  if (!userExists) {
    logger.info("Created admin user", { email: user.email, userId: user.id });
  } else if (userExists.role !== "ADMIN") {
    logger.info("Promoted existing user to ADMIN", {
      email: user.email,
      userId: user.id,
    });
  } else {
    logger.info("Admin user already exists", {
      email: user.email,
      userId: user.id,
    });
  }
}

main()
  .catch((err) => {
    logger.error("Seed failed", errorFields(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
