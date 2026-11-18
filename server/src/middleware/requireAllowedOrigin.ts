import { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { forbiddenOrigin } from "../utils/errors.js";

export function requireAllowedOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const origin = req.headers.origin;
  if (!origin || origin !== env.CORS_ORIGIN) {
    throw forbiddenOrigin();
  }

  next();
}
