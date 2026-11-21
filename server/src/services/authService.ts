import { Prisma } from "../generated/prisma/client.js";
import { createSession, revokeAllUserTokens } from "./tokenService.js";
import { prisma } from "../lib/prisma.js";
import { toPublicUser, publicUserSelect } from "../lib/publicUser.js";
import {
  burnPasswordCheck,
  hashPassword,
  verifyPassword,
} from "../lib/password.js";
import {
  emailTaken,
  invalidCredentials,
  invalidCurrentPassword,
  unauthenticated,
} from "../utils/errors.js";

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
      user: toPublicUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw emailTaken();
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
    await burnPasswordCheck(password);
    throw invalidCredentials();
  }

  const correctPassword = await verifyPassword(user.passwordHash, password);
  if (!correctPassword) {
    throw invalidCredentials();
  }

  const result = await prisma.$transaction(async (tx) => {
    const session = await createSession(tx, {
      id: user.id,
      role: user.role,
    });
    return { user, ...session };
  });

  return {
    user: toPublicUser(result.user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });
  if (!user) {
    throw unauthenticated();
  }
  return user;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, passwordHash: true },
  });

  if (!user) {
    throw unauthenticated();
  }

  const isValid = await verifyPassword(user.passwordHash, currentPassword);
  if (!isValid) {
    throw invalidCurrentPassword();
  }

  const newPasswordHash = await hashPassword(newPassword);

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    await revokeAllUserTokens(tx, userId);

    const { refreshToken } = await createSession(tx, {
      id: user.id,
      role: user.role,
    });
    return refreshToken;
  });
}

export async function ensureAdmin(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const userExist = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!userExist) {
    const passwordHash = await hashPassword(password);
    return prisma.user.create({
      data: {
        email: normalizedEmail,
        displayName: "SuperUser",
        passwordHash,
        role: "ADMIN",
      },
    });
  }

  if (userExist.role !== "ADMIN") {
    return prisma.user.update({
      where: { id: userExist.id },
      data: {
        role: "ADMIN",
      },
    });
  }

  return userExist;
}
