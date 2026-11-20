import { NextFunction, Request, Response } from "express";
import type { Role } from "../generated/prisma/enums.js";
import { prisma } from "../lib/prisma.js";
import { unauthenticated, forbidden } from "../utils/errors.js";

export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        throw unauthenticated();
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        throw unauthenticated();
      }

      if (!roles.includes(user.role)) {
        throw forbidden();
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}
