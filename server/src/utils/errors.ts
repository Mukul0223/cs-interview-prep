import ApiError from "./ApiError.js";

export const unauthenticated = () =>
  new ApiError(401, "UNAUTHENTICATED", "Authentication required");

export const invalidCredentials = () =>
  new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");

export const invalidRefreshToken = () =>
  new ApiError(401, "INVALID_REFRESH_TOKEN", "Token is invalid or expired");

export const emailTaken = () =>
  new ApiError(
    409,
    "EMAIL_TAKEN",
    "An account with this email already exists.",
  );

export const forbiddenOrigin = () =>
  new ApiError(403, "FORBIDDEN_ORIGIN", "Invalid or missing origin");

export const validationFailed = (details: unknown) =>
  new ApiError(400, "VALIDATION_ERROR", "Validation Failed", details);
