import type { Role } from "../generated/prisma/enums.js";

export {};
declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: Role };
    }
  }
}
