import { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import ApiError from "../utils/ApiError.js";

export function requireAllowedOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const origin = req.headers.origin;
  if (!origin || origin !== env.CORS_ORIGIN) {
    throw new ApiError(403, "FORBIDDEN_ORIGIN", "Invalid or missing origin");
  }

  next();
}
