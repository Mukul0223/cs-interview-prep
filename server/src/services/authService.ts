import { Prisma } from "../generated/prisma/client.js";
import ApiError from "../utils/ApiError.js";
import { createSession } from "./tokenService.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";

interface RegisterInput {
  email: string;
  displayName: string;
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
