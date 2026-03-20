import { Request, Response, NextFunction } from "express";

/**
 * Custom error class with HTTP status code.
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
  }
}

/**
 * Wraps an async route handler with try/catch.
 * Catches any thrown error and passes it to Express error middleware.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

/**
 * Global error handling middleware — must be registered LAST in app.use() chain.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error("[ERROR]", err.message, err.stack);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // Unknown error
  const statusCode = 500;
  const message =
    process.env["NODE_ENV"] === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(statusCode).json({
    error: message,
    ...(process.env["NODE_ENV"] !== "production" && { stack: err.stack }),
  });
}
