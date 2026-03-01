import { Request, Response, NextFunction } from 'express';

/**
 * KAAGAZSEVA - Async Wrapper
 * Eliminates try/catch blocks in controllers.
 * Automatically forwards errors to global error middleware.
 */
export const asyncHandler =
  <
    Req extends Request = Request,
    Res extends Response = Response
  >(
    fn: (req: Req, res: Res, next: NextFunction) => Promise<any>
  ) =>
  (req: Req, res: Res, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };