import { Request, Response, NextFunction } from "express";
import { User } from "@prisma/client";
import { RateLimitRequestHandler } from "express-rate-limit";
export declare const authLimiter: RateLimitRequestHandler;
declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}
/**
 * Optional authentication middleware
 * If a token is present, it will authenticate the user but won't fail if no token is provided
 */
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Required authentication middleware
 * Will fail if no valid token is provided
 */
export declare const protect: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const restrictTo: (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map