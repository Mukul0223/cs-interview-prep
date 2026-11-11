import * as z from "zod";

export const registerSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((val) => val.trim().toLowerCase()),
  password: z.string().min(10).max(128),
  displayName: z.string().trim().min(1).max(50),
});
