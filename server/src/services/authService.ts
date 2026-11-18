import { Prisma } from "../generated/prisma/client.js";
import ApiError from "../utils/ApiError.js";
import { createSession } from "./tokenService.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { verifyRefreshToken } from "../lib/tokens.js";

const dummyPassword = await hashPassword("dummy-Password");

interface RegisterInput {
  email: string;
  displayName: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export async function register({
  email,
  password,
  displayName,
}: RegisterInput) {
  try {
    const passwordHash = await hashPassword(password);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          displayName,
          role: "USER",
        },
      });
      const session = await createSession(tx, {
        id: user.id,
        role: user.role,
      });

      return { user, ...session };
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.displayName,
        role: result.user.role,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  } catch (err) {
    // Fixed: 'P2002' must be uppercase
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ApiError(
        409,
        "EMAIL_TAKEN",
        "An account with this email already exists.",
      );
    }
    throw err;
  }
}

export async function login({ email, password }: LoginInput) {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    await verifyPassword(dummyPassword, password);
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const correctPassword = await verifyPassword(user.passwordHash, password);
  if (!correctPassword) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const result = await prisma.$transaction(async (tx) => {
    const session = await createSession(tx, {
      id: user.id,
      role: user.role,
    });
    return { user, ...session };
  });

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      displayName: result.user.displayName,
      role: result.user.role,
    },
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  };
}

export async function refresh(rawToken: string | undefined) {
  const refreshToken = await verifyRefreshToken(rawToken);
  if (!refreshToken || refreshToken.expiresAt < new Date()) {
    throw new ApiError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Token is invalid or expired",
    );
  }
  const now = new Date();
  let isReuse = false;
  let newRefreshToken: any = null;
  await prisma.$transaction(async (tx) => {
    const result = await tx.refreshToken.updateMany({
      where: {
        id: refreshToken.id,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    if (result.count === 0) {
      isReuse = true;
      return;
    }

    newRefreshToken = await createSession(
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
        replacedByTokenId: newRefreshToken.refreshTokenId,
      },
    });
  });

  if (isReuse) {
    await prisma.refreshToken.updateMany({
      where: {
        familyId: refreshToken.familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });
    console.warn("refresh token reuse detected", {
      familyId: refreshToken?.familyId,
    });
    throw new ApiError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Token is invalid or expired",
    );
  }

  return newRefreshToken;
}

export async function logout(rawToken: string | undefined) {
  if (!rawToken) {
    return;
  }

  try {
    const refreshToken = await verifyRefreshToken(rawToken);

    if (refreshToken && !refreshToken.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: {
          id: refreshToken.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.error("Silent logout", err);
  }
  return;
}
