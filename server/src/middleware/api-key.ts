import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { AppError } from '../utils/response';

function hashKey(key: string) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function authenticateApiKey(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers['x-api-key'] as string | undefined;
  if (!header) {
    return next(new AppError(401, 'API key required'));
  }

  const keyHash = hashKey(header);
  const apiKey = await prisma.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
  });

  if (!apiKey) {
    return next(new AppError(401, 'Invalid API key'));
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  // Integration principal only. loadOrgRole / OWNER|ADMIN routes reject this userId.
  req.user = {
    userId: 'api-key',
    email: 'api@integration',
    organizationId: apiKey.organizationId,
  };

  next();
}
