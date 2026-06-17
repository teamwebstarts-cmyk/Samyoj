import { Router, Request, Response } from 'express';
import brandKitRoutes from './brand-kit/routes';
import composerRoutes from './composer/routes';
import imagesRoutes from './images/routes';
import libraryRoutes from './library/routes';
import calendarRoutes from './calendar/routes';
import approvalsRoutes from './approvals/routes';
import voicesRoutes from './voices/routes';
import videosRoutes from './videos/routes';
import { authenticate, requireOrg } from '../../middleware/auth';
import { sendSuccess, asyncHandler } from '../../utils/response';

const router = Router();

router.get(
  '/credits',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { getCreditSummary } = await import('./shared/cost-guard');
    const summary = await getCreditSummary(req.user!.organizationId!);
    sendSuccess(res, summary);
  })
);

router.use('/brand-kit', brandKitRoutes);
router.use('/composer', composerRoutes);
router.use('/images', imagesRoutes);
router.use('/library', libraryRoutes);
router.use('/calendar', calendarRoutes);
router.use('/approvals', approvalsRoutes);
router.use('/voices', voicesRoutes);
router.use('/videos', videosRoutes);

export default router;
