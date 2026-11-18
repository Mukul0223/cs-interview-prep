import { Request, Response, NextFunction } from "express";
import * as z from "zod";
import { validationFailed } from "../utils/errors.js";

export const validate = <T extends z.ZodType>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return next(validationFailed(formattedErrors));
    }
    req.body = result.data;
    next();
  };
};
