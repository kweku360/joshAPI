import { Request, Response, NextFunction } from "express";
/**
 * Wraps an async express route handler to automatically catch errors
 * and pass them to the next middleware (error handler)
 *
 * @param fn The async route handler function to wrap
 * @returns A function that catches any errors and passes them to next()
 */
export declare const catchAsync: (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=catchAsync.d.ts.map