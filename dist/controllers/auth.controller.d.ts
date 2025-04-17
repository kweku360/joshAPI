import { Request, Response, NextFunction } from "express";
export declare const authController: {
    /**
     * Send OTP for registration
     */
    registerOTP(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Verify OTP and complete registration
     */
    verifyOTP(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Send OTP for login
     */
    loginOTP(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Verify login OTP
     */
    verifyLoginOTP(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Authenticate with Google
     */
    googleAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
    logout(req: Request, res: Response): Promise<void>;
    /**
     * Create guest account with OTP
     * @route POST /auth/guest
     * @access Public
     */
    createGuestAccount(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Verify OTP and create guest account
     * @route POST /auth/verify-guest
     * @access Public
     */
    verifyGuestOTP(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Upgrade guest account to full user account
     * @route POST /auth/upgrade-guest
     * @access Public
     */
    upgradeGuestAccount(req: Request, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=auth.controller.d.ts.map