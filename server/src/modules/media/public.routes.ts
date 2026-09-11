import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/response';
import { readMediaFile, mediaFileExists } from './storage';
import { isValidPublicMediaSig } from './public-sign';

const router = Router();

router.get(
  '/:orgId/:filename',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = String(req.params.orgId);
    const filename = String(req.params.filename);
    if (!orgId || !filename || filename.includes('..') || filename.includes('/')) {
      res.status(400).send('Invalid path');
      return;
    }

    const relativePath = `${orgId}/${filename}`;
    if (!isValidPublicMediaSig(relativePath, req.query.exp, req.query.sig)) {
      res.status(401).send('Unauthorized');
      return;
    }

    if (!(await mediaFileExists(relativePath))) {
      res.status(404).send('Not found');
      return;
    }

    const buffer = await readMediaFile(relativePath);
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      mp4: 'video/mp4',
      '3gp': 'video/3gpp',
      pdf: 'application/pdf',
      ogg: 'audio/ogg',
      mp3: 'audio/mpeg',
      aac: 'audio/aac',
      amr: 'audio/amr',
    };

    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  })
);

export default router;
