import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function asyncHandler<T extends Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return async (req: T, res: Response, next: NextFunction) => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await handler(req, res, next);
        return;
      } catch (error) {
        if (attempt === 3 || res.headersSent || !isTransientDatabaseError(error)) {
          next(error);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 800));
      }
    }
  };
}

function isTransientDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Can't reach database server") || message.includes("Connection terminated");
}

export function ok(res: Response, data: unknown = null) {
  res.json({ success: true, data });
}
