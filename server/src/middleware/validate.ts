import type { Request, Response, NextFunction } from "express";
import { ZodError, ZodSchema } from "zod";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: "ValidationError",
          issues: err.issues,
        });
        return;
      }
      next(err);
    }
  };
}
