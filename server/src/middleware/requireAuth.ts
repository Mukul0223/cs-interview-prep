import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError.js";
import { verifyAccessToken } from "../lib/tokens.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
    }
    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
    }

    const payload = await verifyAccessToken(token);

    req.auth = { userId: payload.userId, role: payload.role };
    next();
  } catch (err) {
    next(new ApiError(401, "UNAUTHENTICATED", "Authentication required"));
  }
}
