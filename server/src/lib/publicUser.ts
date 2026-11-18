import type { Prisma } from "../generated/prisma/client.js";

export const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

export function toPublicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}
