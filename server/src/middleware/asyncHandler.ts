import { Request, Response, NextFunction, RequestHandler } from 'express';
import { debugLog } from '../utils/logger';

/**
 * Type for async route handlers that may throw errors
 */
type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

/**
 * Wraps an async route handler to automatically catch errors and pass them to Express error handling.
 * This eliminates the need for repetitive try/catch blocks in every route handler.
 *
 * @example
 * // Before:
 * router.get('/', async (req, res) => {
 *   try {
 *     const data = await service.getAll();
 *     res.json(data);
 *   } catch (error) {
 *     console.error('Error:', error);
 *     res.status(500).json({ error: 'Failed to fetch data' });
 *   }
 * });
 *
 * // After:
 * router.get('/', asyncHandler(async (req, res) => {
 *   const data = await service.getAll();
 *   res.json(data);
 * }));
 */
export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error: unknown) => {
      debugLog.error(`Route error: ${req.method} ${req.path}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // If response has already been sent, pass to default error handler
      if (res.headersSent) {
        return next(error);
      }

      // Send a generic error response
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    });
  };
};
