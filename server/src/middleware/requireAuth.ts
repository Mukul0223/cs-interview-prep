import { Request, Response, NextFunction } from "express";
import { unauthenticated } from "../utils/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      throw unauthenticated();
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw unauthenticated();
    }

    const payload = await verifyAccessToken(token);

    req.auth = { userId: payload.userId, role: payload.role };
    next();
  } catch {
    next(unauthenticated());
  }
}
