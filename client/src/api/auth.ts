import { apiFetch, setAccessToken } from "./http";

export type UserRole = "USER" | "ADMIN";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AuthSessionResponse {
  accessToken: string;
  user: User;
}

export async function register(input: RegisterInput): Promise<User> {
  const res = await apiFetch<AuthSessionResponse>("/auth/register", {
    method: "POST",
    body: input,
    auth: false,
  });

  if (res.accessToken) {
    setAccessToken(res.accessToken);
  }

  return res.user;
}

export async function login(input: LoginInput): Promise<User> {
  const res = await apiFetch<AuthSessionResponse>("/auth/login", {
    method: "POST",
    body: input,
    auth: false,
  });

  if (res.accessToken) {
    setAccessToken(res.accessToken);
  }

  return res.user;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<void>("/auth/logout", {
      method: "POST",
    });
  } finally {
    setAccessToken(null);
  }
}

export async function getMe(): Promise<User> {
  const res = await apiFetch<{ user: User }>("/auth/me", {
    method: "GET",
  });
  return res.user;
}

export async function changePassword(
  input: ChangePasswordInput,
): Promise<void> {
  await apiFetch<void>("/auth/change-password", {
    method: "POST",
    body: input,
  });
}
