import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { AppError } from "./appError";

/**
 * Generates a CSRF token
 * @returns Object containing token and tokenHash
 */
export function generateCsrfToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  return { token, tokenHash };
}

/**
 * Validates a CSRF token against its hash
 * @param token The CSRF token
 * @param tokenHash The hashed token to validate against
 * @returns Boolean indicating if the token is valid
 */
export function validateCsrfToken(token: string, tokenHash: string): boolean {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return hash === tokenHash;
}

/**
 * Middleware to check CSRF token
 */
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip CSRF check for non-mutating methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const csrfToken = req.headers["x-csrf-token"] as string;
  const csrfTokenHash = req.cookies?.csrfToken;

  if (!csrfToken || !csrfTokenHash) {
    return next(new AppError("CSRF token missing", 403));
  }

  if (!validateCsrfToken(csrfToken, csrfTokenHash)) {
    return next(new AppError("Invalid CSRF token", 403));
  }

  next();
}

/**
 * Check if a password meets strength requirements
 * @param password The password to check
 * @returns true if password is strong enough
 */
export function isStrongPassword(password: string): boolean {
  const minLength = 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  return (
    password.length >= minLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumbers &&
    hasSpecialChar
  );
}

/**
 * Middleware to protect against HTTP Parameter Pollution
 */
export function paramPollutionProtection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Clean up query parameters
  const cleanQuery: Record<string, string> = {};

  for (const [key, value] of Object.entries(req.query)) {
    // Only keep the last value if multiple values are provided
    if (Array.isArray(value)) {
      cleanQuery[key] = String(value[value.length - 1]);
    } else {
      cleanQuery[key] = String(value);
    }
  }

  req.query = cleanQuery;
  next();
}

/**
 * Sanitize user input to prevent common injection attacks
 */
export function sanitizeInput(input: string): string {
  // Remove script tags and other potentially dangerous HTML
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "") // Remove event handlers
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .trim();
}
