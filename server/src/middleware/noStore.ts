import { Request, Response, NextFunction } from 'express';

/**
 * Forbid caching of responses that handle authentication or third-party
 * credentials. Intuit's QBO app security review requires `no-cache, no-store`
 * (not `private`) on any SSL page that returns sensitive data.
 */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}
