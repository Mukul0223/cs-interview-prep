import crypto from "crypto";
import { SignJWT } from "jose";
import { Prisma } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const encodedAccessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export async function createSession(
  tx: Prisma.TransactionClient,
  user: { id: string; email: string; role?: string },
  existingFamilyId?: string,
) {
  const rawRefreshToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawRefreshToken)
    .digest("hex");
  const familyId = existingFamilyId ?? crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await tx.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt,
    },
  });

  const accessToken = await new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL_MINUTES)
    .sign(encodedAccessSecret);

  return { accessToken, refreshToken: rawRefreshToken };
}
