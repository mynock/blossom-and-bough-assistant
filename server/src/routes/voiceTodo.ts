import { Router } from 'express';
import { requireApiKey } from '../middleware/apiKeyAuth';
import { asyncHandler } from '../middleware/asyncHandler';
import { services } from '../services/container';

const router = Router();

router.post('/', requireApiKey, asyncHandler(async (req, res) => {
  const { transcription, classify_only } = req.body;

  if (!transcription || typeof transcription !== 'string') {
    return res.status(400).json({ error: 'transcription field is required and must be a string' });
  }

  if (transcription.length > 10000) {
    return res.status(400).json({ error: 'transcription must not exceed 10000 characters' });
  }

  const result = await services.voiceTodoService.processTranscription(
    transcription,
    classify_only === true,
  );

  res.json(result);
}));

export default router;
