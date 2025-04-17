import { Request, Response, NextFunction } from "express";
export declare const userController: {
    getProfile(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get user profile with their bookings
     */
    getProfileWithBookings(req: Request, res: Response, next: NextFunction): Promise<void>;
    updateProfile(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get user's bookings (both recent and past)
     */
    getUserBookings(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Delete user account
     */
    deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=user.controller.d.ts.map