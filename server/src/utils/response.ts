import { Request, Response, NextFunction, RequestHandler } from 'express';

export { AppError } from '../errors';

export function sendSuccess(res: Response, data: unknown, statusCode = 200) {
  res.set('Cache-Control', 'no-store');
  return res.status(statusCode).json({ success: true, data });
}

export function sendError(res: Response, message: string, statusCode = 500, code?: string) {
  return res.status(statusCode).json({ success: false, error: { message, code } });
}

export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function paramId(req: Request): string {
  return req.params.id as string;
}
