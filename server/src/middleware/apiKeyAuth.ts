import { Request, Response, NextFunction } from 'express';

export const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = process.env.VOICE_TODO_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'VOICE_TODO_API_KEY not configured on server' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  if (token !== apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};
