import { Response } from "express";
import { env } from "../config/env.js";

export const setRefreshCookie = (res: Response, raw: string) => {
  res.cookie("refresh_token", raw, {
    httpOnly: true,
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    secure: env.NODE_ENV === "production",
  });
};

export const clearRefreshCookie = (res: Response) => {
  res.clearCookie("refresh_token", {
    httpOnly: true,
    sameSite: "strict",
    path: "/api/v1/auth",
    secure: env.NODE_ENV === "production",
  });
};
