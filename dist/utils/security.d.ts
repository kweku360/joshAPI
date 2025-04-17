import { Request, Response, NextFunction } from "express";
/**
 * Generates a CSRF token
 * @returns Object containing token and tokenHash
 */
export declare function generateCsrfToken(): {
    token: string;
    tokenHash: string;
};
/**
 * Validates a CSRF token against its hash
 * @param token The CSRF token
 * @param tokenHash The hashed token to validate against
 * @returns Boolean indicating if the token is valid
 */
export declare function validateCsrfToken(token: string, tokenHash: string): boolean;
/**
 * Middleware to check CSRF token
 */
export declare function csrfProtection(req: Request, res: Response, next: NextFunction): void;
/**
 * Check if a password meets strength requirements
 * @param password The password to check
 * @returns true if password is strong enough
 */
export declare function isStrongPassword(password: string): boolean;
/**
 * Middleware to protect against HTTP Parameter Pollution
 */
export declare function paramPollutionProtection(req: Request, res: Response, next: NextFunction): void;
/**
 * Sanitize user input to prevent common injection attacks
 */
export declare function sanitizeInput(input: string): string;
//# sourceMappingURL=security.d.ts.map