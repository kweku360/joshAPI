import { TokenType } from "@prisma/client";
import { IUser, IGuestUser } from "../interfaces/user.interface";
export declare const authService: {
    /**
     * Create guest account with OTP verification
     * @param email User email
     * @returns Expiration time of OTP
     */
    createGuestAccount(email: string): Promise<Date>;
    /**
     * Verify guest OTP and create guest user account
     * @param email User email
     * @param otp OTP code
     * @returns Guest user data
     */
    verifyGuestOTP(email: string, otp: string): Promise<IGuestUser>;
    /**
     * Create verification token
     * @param userId User ID
     * @param type Token type
     * @returns Token string
     */
    createVerificationToken(userId: string, type: TokenType): Promise<string>;
    /**
     * Sign JWT token
     * @param userId User ID
     * @returns JWT token
     */
    signToken(userId: string): string;
    /**
     * Verify JWT token
     * @param token JWT token
     * @returns Token payload
     */
    verifyToken(token: string): {
        id: string;
        iat: number;
    };
    /**
     * Start OTP-based registration process
     * @param email User email
     * @returns Expiration time of OTP
     */
    registerWithOTP(email: string): Promise<Date>;
    /**
     * Verify OTP and complete registration
     * @param email User email
     * @param otp OTP code
     * @param firstName User first name
     * @param lastName User last name
     * @param phone Optional user phone number
     * @returns Created user and token
     */
    verifyOTPAndRegister(email: string, otp: string, firstName: string, lastName: string, phone?: string): Promise<{
        user: IUser;
        token: string;
    }>;
    /**
     * Start OTP-based login process
     * @param email User email
     * @returns Expiration time of OTP
     */
    loginWithOTP(email: string): Promise<Date>;
    /**
     * Verify OTP and complete login
     * @param email User email
     * @param otp The OTP code
     * @returns User and token
     */
    verifyOTPAndLogin(email: string, otp: string): Promise<{
        user: IUser;
        token: string;
    }>;
    /**
     * Upgrade a guest user to a regular user
     * @param email User email
     * @param firstName First name
     * @param lastName Last name
     * @param phone Optional phone number
     * @returns Updated user and token
     */
    upgradeGuestUser(email: string, firstName: string, lastName: string, phone?: string): Promise<{
        user: IUser;
        token: string;
    }>;
    /**
     * Authenticate with Google
     * @param googleIdToken Google ID token
     * @returns User and token
     */
    googleAuth(googleIdToken: string): Promise<{
        user: IUser;
        token: string;
    }>;
};
//# sourceMappingURL=auth.service.d.ts.map