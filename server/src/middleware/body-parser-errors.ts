import type { NextFunction, Request, Response } from 'express';

export function rejectBadJsonBody(err: unknown, _req: Request, res: Response, next: NextFunction) {
  const parseError = err as { type?: string };
  if (parseError?.type === 'entity.parse.failed') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
    });
    return;
  }
  if (parseError?.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: { code: 'BODY_TOO_LARGE', message: 'Request body is too large' },
    });
    return;
  }
  next(err);
}
