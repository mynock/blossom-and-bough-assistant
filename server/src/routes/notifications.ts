import express from 'express';
import { services } from '../services/container';
import { asyncHandler } from '../middleware/asyncHandler';

const router = express.Router();
const notificationService = services.notificationService;

/**
 * GET /api/notifications
 * Query params:
 *   - includeRead=true|false (default true) — include already-read but undismissed
 *   - includeDismissed=true|false (default false)
 *   - limit (default 50)
 */
router.get('/', asyncHandler(async (req, res) => {
  const includeRead = req.query.includeRead !== 'false';
  const includeDismissed = req.query.includeDismissed === 'true';
  const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10) || 50, 200) : 50;

  const list = includeDismissed
    ? await notificationService.listAll(limit)
    : await notificationService.listActive({ limit, includeRead });

  res.json(list);
}));

/**
 * GET /api/notifications/unread-count
 */
router.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await notificationService.countUnread();
  res.json({ count });
}));

/**
 * POST /api/notifications/read-all
 */
router.post('/read-all', asyncHandler(async (req, res) => {
  const updated = await notificationService.markAllRead();
  res.json({ updated });
}));

/**
 * POST /api/notifications/:id/read
 */
router.post('/:id/read', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid notification ID' });

  const updated = await notificationService.markRead(id);
  if (!updated) return res.status(404).json({ error: 'Notification not found' });
  res.json(updated);
}));

/**
 * POST /api/notifications/:id/dismiss
 */
router.post('/:id/dismiss', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid notification ID' });

  const updated = await notificationService.dismiss(id);
  if (!updated) return res.status(404).json({ error: 'Notification not found' });
  res.json(updated);
}));

export default router;
