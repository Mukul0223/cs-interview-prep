import crypto from "node:crypto";
import type { Prisma, Role } from "../generated/prisma/client.js";
import { env } from "../config/env.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from "../lib/tokens.js";

const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export async function createSession(
  tx: Prisma.TransactionClient,
  user: { id: string; role: Role },
  existingFamilyId?: string,
) {
  const refreshToken = generateRefreshToken();

  await tx.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      familyId: existingFamilyId ?? crypto.randomUUID(),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  const accessToken = await signAccessToken({
    userId: user.id,
    role: user.role,
  });

  return { accessToken, refreshToken };
}
