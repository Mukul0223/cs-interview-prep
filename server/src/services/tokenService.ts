import crypto from "node:crypto";
import type { Prisma, Role } from "../generated/prisma/client.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from "../lib/tokens.js";
import { invalidRefreshToken } from "../utils/errors.js";

const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export async function createSession(
  tx: Prisma.TransactionClient,
  user: { id: string; role: Role },
  existingFamilyId?: string,
) {
  const refreshToken = generateRefreshToken();

  const createdToken = await tx.refreshToken.create({
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

  return { accessToken, refreshToken, refreshTokenId: createdToken.id };
}

export async function findRefreshTokenByRaw(rawToken: string | undefined) {
  if (!rawToken) {
    return null;
  }

  const hashToken = hashRefreshToken(rawToken);
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: {
      tokenHash: hashToken,
    },
    include: {
      user: true,
    },
  });
  return tokenRecord;
}

type Session = Awaited<ReturnType<typeof createSession>>;
type RotateResult = { reused: true } | { reused: false; newSession: Session };

export async function rotateRefreshToken(rawToken: string | undefined) {
  const refreshToken = await findRefreshTokenByRaw(rawToken);
  if (!refreshToken || refreshToken.expiresAt < new Date()) {
    throw invalidRefreshToken();
  }
  const now = new Date();

  // Run the transaction and get back the discriminated union result
  const result = await prisma.$transaction<RotateResult>(async (tx) => {
    const updateResult = await tx.refreshToken.updateMany({
      where: {
        id: refreshToken.id,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    if (updateResult.count === 0) {
      return { reused: true };
    }

    const newSession = await createSession(
      tx,
      {
        id: refreshToken.userId,
        role: refreshToken.user.role,
      },
      refreshToken.familyId,
    );

    await tx.refreshToken.update({
      where: {
        id: refreshToken.id,
      },
      data: {
        replacedByTokenId: newSession.refreshTokenId,
      },
    });

    return {
      reused: false,
      newSession,
    };
  });

  // Branch on the result after the transaction completes
  if (result.reused) {
    await prisma.refreshToken.updateMany({
      where: {
        familyId: refreshToken.familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });
    logger.warn("refresh_token_reuse_detected", {
      familyId: refreshToken.familyId,
    });
    throw invalidRefreshToken();
  }

  return result.newSession;
}

export async function revokeRefreshToken(rawToken: string | undefined) {
  if (!rawToken) return;
  const refreshToken = await findRefreshTokenByRaw(rawToken);
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({
    where: { id: refreshToken.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
