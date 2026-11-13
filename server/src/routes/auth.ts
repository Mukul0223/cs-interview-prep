import { login, register } from "../services/authService.js";
import { Router } from "express";
import { loginSchema, registerSchema } from "../schemas/auth.js";
import { validate } from "../middleware/validate.js";
import { setRefreshCookie } from "../lib/cookies.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { prisma } from "../lib/prisma.js";
import ApiError from "../utils/ApiError.js";

const router = Router();

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await register(req.body);
    setRefreshCookie(res, refreshToken);

    return res.status(201).json({ user, accessToken });
  } catch (error) {
    next(error);
  }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await login(req.body);
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({ user, accessToken });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth?.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });

    if (!user) {
      throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
    }

    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
