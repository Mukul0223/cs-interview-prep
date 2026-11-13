import { Prisma } from "../generated/prisma/client.js";
import ApiError from "../utils/ApiError.js";
import { createSession } from "./tokenService.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

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
