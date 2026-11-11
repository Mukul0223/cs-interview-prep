import { register } from "../services/authService.js";
import { Router } from "express";
import { registerSchema } from "../schemas/auth.js";
import { validate } from "../middleware/validate.js";
import { setRefreshCookie } from "../lib/cookies.js";

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

export default router;
