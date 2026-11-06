import { SignJWT, jwtVerify } from "jose";
import { Role } from "../generated/prisma/client.js";
import crypto from "node:crypto";
import { env } from "../config/env.js";

function getAccessTokenSecret(): Uint8Array {
  const secret = env.JWT_ACCESS_SECRET;
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(input: {
  userId: string;
  role: Role;
}): Promise<string> {
  const ttlMinutes = env.ACCESS_TOKEN_TTL_MINUTES;

  return await new SignJWT({ role: input.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(`${ttlMinutes}m`)
    .sign(getAccessTokenSecret());
}

export async function verifyAccessToken(
  token: string,
): Promise<{ userId: string; role: Role }> {
  const { payload } = await jwtVerify(token, getAccessTokenSecret(), {
    algorithms: ["HS256"],
    requiredClaims: ["sub", "exp"],
  });

  const userId = payload.sub;
  const role = payload.role;

  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid token: missing or Invalid subject.");
  }

  if (
    !role ||
    typeof role !== "string" ||
    !Object.values(Role).includes(role as Role)
  ) {
    throw new Error("Invalid token: unrecognized or missing role.");
  }

  return { userId, role: role as Role };
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
