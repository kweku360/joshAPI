import { Request, Response, NextFunction } from "express";
/**
 * Middleware to fix objects with numeric keys that should be arrays in request body
 * This is particularly important for the flight booking and pricing endpoints
 */
export declare const fixArrayStructureMiddleware: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=fixArrays.middleware.d.ts.map