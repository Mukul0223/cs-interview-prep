import { apiFetch, setAccessToken } from "./http";

export type UserRole = "user" | "admin" | (string & {});

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
  accessToken?: string;
  user?: User;
}

function hasWrappedUser(
  payload: User | { user: User },
): payload is { user: User } {
  return "user" in payload && Boolean(payload.user);
}

function extractUser(payload: User | { user: User }): User {
  if (hasWrappedUser(payload)) {
    return payload.user;
  }
  return payload;
}

export async function register(input: RegisterInput): Promise<User> {
  const res = await apiFetch<AuthSessionResponse | User>("/auth/register", {
    method: "POST",
    body: input,
    auth: false,
  });

  if (
    "accessToken" in res &&
    typeof res.accessToken === "string" &&
    res.accessToken
  ) {
    setAccessToken(res.accessToken);
  }

  if ("user" in res && res.user) {
    return res.user;
  }

  return getMe();
}

export async function login(input: LoginInput): Promise<User> {
  const res = await apiFetch<AuthSessionResponse | User>("/auth/login", {
    method: "POST",
    body: input,
    auth: false,
  });

  if (
    "accessToken" in res &&
    typeof res.accessToken === "string" &&
    res.accessToken
  ) {
    setAccessToken(res.accessToken);
  }

  if ("user" in res && res.user) {
    return res.user;
  }

  return getMe();
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
  const res = await apiFetch<User | { user: User }>("/auth/me", {
    method: "GET",
  });
  return extractUser(res);
}

export async function changePassword(
  input: ChangePasswordInput,
): Promise<void> {
  await apiFetch<void>("/auth/change-password", {
    method: "POST",
    body: input,
  });
}
