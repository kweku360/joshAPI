"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCsrfToken = generateCsrfToken;
exports.validateCsrfToken = validateCsrfToken;
exports.csrfProtection = csrfProtection;
exports.isStrongPassword = isStrongPassword;
exports.paramPollutionProtection = paramPollutionProtection;
exports.sanitizeInput = sanitizeInput;
const crypto_1 = __importDefault(require("crypto"));
const appError_1 = require("./appError");
/**
 * Generates a CSRF token
 * @returns Object containing token and tokenHash
 */
function generateCsrfToken() {
    const token = crypto_1.default.randomBytes(32).toString("hex");
    const tokenHash = crypto_1.default.createHash("sha256").update(token).digest("hex");
    return { token, tokenHash };
}
/**
 * Validates a CSRF token against its hash
 * @param token The CSRF token
 * @param tokenHash The hashed token to validate against
 * @returns Boolean indicating if the token is valid
 */
function validateCsrfToken(token, tokenHash) {
    const hash = crypto_1.default.createHash("sha256").update(token).digest("hex");
    return hash === tokenHash;
}
/**
 * Middleware to check CSRF token
 */
function csrfProtection(req, res, next) {
    var _a;
    // Skip CSRF check for non-mutating methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        return next();
    }
    const csrfToken = req.headers["x-csrf-token"];
    const csrfTokenHash = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.csrfToken;
    if (!csrfToken || !csrfTokenHash) {
        return next(new appError_1.AppError("CSRF token missing", 403));
    }
    if (!validateCsrfToken(csrfToken, csrfTokenHash)) {
        return next(new appError_1.AppError("Invalid CSRF token", 403));
    }
    next();
}
/**
 * Check if a password meets strength requirements
 * @param password The password to check
 * @returns true if password is strong enough
 */
function isStrongPassword(password) {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    return (password.length >= minLength &&
        hasUppercase &&
        hasLowercase &&
        hasNumbers &&
        hasSpecialChar);
}
/**
 * Middleware to protect against HTTP Parameter Pollution
 */
function paramPollutionProtection(req, res, next) {
    // Clean up query parameters
    const cleanQuery = {};
    for (const [key, value] of Object.entries(req.query)) {
        // Only keep the last value if multiple values are provided
        if (Array.isArray(value)) {
            cleanQuery[key] = String(value[value.length - 1]);
        }
        else {
            cleanQuery[key] = String(value);
        }
    }
    req.query = cleanQuery;
    next();
}
/**
 * Sanitize user input to prevent common injection attacks
 */
function sanitizeInput(input) {
    // Remove script tags and other potentially dangerous HTML
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/on\w+="[^"]*"/gi, "") // Remove event handlers
        .replace(/javascript:/gi, "") // Remove javascript: protocol
        .trim();
}
//# sourceMappingURL=security.js.map