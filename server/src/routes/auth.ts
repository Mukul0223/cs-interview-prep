import { login, register, getCurrentUser } from "../services/authService.js";
import {
  rotateRefreshToken,
  revokeRefreshToken,
} from "../services/tokenService.js";
import { Router } from "express";
import { loginSchema, registerSchema } from "../schemas/auth.js";
import { validate } from "../middleware/validate.js";
import { clearRefreshCookie, setRefreshCookie } from "../lib/cookies.js";
import { requireAuth } from "../middleware/requireAuth.js";
import ApiError from "../utils/ApiError.js";
import { requireAllowedOrigin } from "../middleware/requireAllowedOrigin.js";

const router = Router();

router.post("/register", validate(registerSchema), async (req, res) => {
  const { user, accessToken, refreshToken } = await register(req.body);
  setRefreshCookie(res, refreshToken);
  return res.status(201).json({ user, accessToken });
});

router.post("/login", validate(loginSchema), async (req, res) => {
  const { user, accessToken, refreshToken } = await login(req.body);
  setRefreshCookie(res, refreshToken);
  return res.status(200).json({ user, accessToken });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await getCurrentUser(req.auth!.userId);
  return res.status(200).json({ user });
});

router.post("/refresh", requireAllowedOrigin, async (req, res) => {
  try {
    const rawRefreshToken = req.cookies?.refresh_token;

    const { accessToken, refreshToken: newRawToken } =
      await rotateRefreshToken(rawRefreshToken);

    setRefreshCookie(res, newRawToken);

    return res.status(200).json({ accessToken });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      clearRefreshCookie(res);
    }
    throw error;
  }
});

router.post("/logout", requireAllowedOrigin, async (req, res) => {
  try {
    await revokeRefreshToken(req.cookies?.refresh_token);
  } finally {
    clearRefreshCookie(res);
  }
  return res.status(204).end();
});

export default router;
