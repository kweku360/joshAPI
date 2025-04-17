import { Request, Response, NextFunction } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
export declare const authMiddleware: {
    authLimiter: RateLimitRequestHandler;
    protect: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    optionalAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    restrictTo: (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
};
//# sourceMappingURL=authMiddleware.d.ts.map