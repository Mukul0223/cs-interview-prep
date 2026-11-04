import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError.js";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) {
    return next(err);
  }

  let normalizedError = err;

  // Safely check err.type since err is typed as unknown
  if (typeof err === "object" && err !== null && "type" in err) {
    if (err.type === "entity.parse.failed") {
      normalizedError = new ApiError(
        400,
        "INVALID_JSON",
        "Invalid JSON payload",
      );
    } else if (err.type === "entity.too.large") {
      normalizedError = new ApiError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Size limit exceeded",
      );
    }
  }

  const isApiError = normalizedError instanceof ApiError;

  const statusCode = isApiError
    ? (normalizedError as ApiError).statusCode
    : 500;
  const code = isApiError
    ? (normalizedError as ApiError).code
    : "INTERNAL_SERVER_ERROR";
  const message = isApiError
    ? (normalizedError as ApiError).message
    : "Internal server error";
  const details = isApiError
    ? (normalizedError as ApiError).details
    : undefined;

  // Log unexpected internal server errors (do not log operational ApiErrors)
  if (!isApiError) {
    console.error(err);
  }

  // Build the response object cleanly to satisfy TypeScript's strict types
  const errorObj: { code: string; message: string; details?: unknown } = {
    code,
    message,
  };

  if (details !== null && details !== undefined) {
    errorObj.details = details;
  }

  res.status(statusCode).json({
    error: errorObj,
  });
};

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  next(new ApiError(404, "NOT_FOUND", "Not Found"));
};
