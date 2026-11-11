import { Request, Response, NextFunction } from "express";
import * as z from "zod";
import ApiError from "../utils/ApiError.js";

export const validate = <T extends z.ZodType>(
  schema: T,
  source: "body" | "query" | "params" = "body",
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return next(
        new ApiError(
          400,
          "VALIDATION_ERROR",
          "Validation Failed",
          formattedErrors,
        ),
      );
    }
    req[source] = result.data;
    next();
  };
};
