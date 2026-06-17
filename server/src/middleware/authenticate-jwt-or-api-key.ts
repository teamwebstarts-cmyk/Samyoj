import { Request, Response, NextFunction } from 'express';
import { authenticate } from './auth';
import { authenticateApiKey } from './api-key';

export function authenticateJwtOrApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const bearer = req.headers.authorization;

  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }
  if (bearer?.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }
  return authenticate(req, res, next);
}
