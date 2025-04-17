"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restrictTo = exports.protect = exports.optionalAuth = exports.authLimiter = void 0;
const client_1 = require("@prisma/client");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Rate limiting for auth endpoints
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes 
    max: 10, // limit each IP to 10 requests per windowMs
    message: "Too many requests from this IP, please try again after 15 minutes",
    skipSuccessfulRequests: true, // only count failed requests
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable X-RateLimit headers
});
const appError_1 = require("../utils/appError");
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient();
/**
 * Optional authentication middleware
 * If a token is present, it will authenticate the user but won't fail if no token is provided
 */
const optionalAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        let token;
        // Get token from Authorization header or cookie
        if (req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }
        else if ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.jwt) {
            token = req.cookies.jwt;
        }
        // If no token, just continue as guest
        if (!token) {
            return next();
        }
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwtSecret);
        if (!decoded || !decoded.id) {
            // Invalid token but we don't want to fail
            return next();
        }
        // Check if user still exists
        const user = yield prisma.user.findUnique({
            where: { id: decoded.id },
        });
        if (!user) {
            // User doesn't exist but we don't want to fail
            return next();
        }
        // Check if user is active
        if (user.status === 'INACTIVE') {
            // User inactive but we don't want to fail
            return next();
        }
        // Check if user changed password after the token was issued
        if (user.passwordResetAt) {
            const changedTimestamp = user.passwordResetAt.getTime() / 1000;
            if (decoded.iat < changedTimestamp) {
                // Token expired but we don't want to fail
                return next();
            }
        }
        // Grant access to protected route
        req.user = user;
        next();
    }
    catch (error) {
        // Any error, just continue as guest
        logger_1.logger.debug("Optional auth error", error);
        next();
    }
});
exports.optionalAuth = optionalAuth;
/**
 * Required authentication middleware
 * Will fail if no valid token is provided
 */
const protect = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        let token;
        // Get token from Authorization header or cookie
        if (req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }
        else if ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.jwt) {
            token = req.cookies.jwt;
        }
        if (!token) {
            return next(new appError_1.AppError("You are not logged in. Please log in to get access.", 401));
        }
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwtSecret);
        if (!decoded || !decoded.id) {
            return next(new appError_1.AppError("Invalid token format", 401));
        }
        // Check if user still exists
        const user = yield prisma.user.findUnique({
            where: { id: decoded.id },
        });
        if (!user) {
            return next(new appError_1.AppError("The user belonging to this token no longer exists.", 401));
        }
        // Check if user is active
        if (user.status === 'INACTIVE') {
            return next(new appError_1.AppError("This account has been deactivated.", 401));
        }
        // Check if user changed password after the token was issued
        if (user.passwordResetAt) {
            const changedTimestamp = user.passwordResetAt.getTime() / 1000;
            if (decoded.iat < changedTimestamp) {
                return next(new appError_1.AppError("User recently changed password. Please log in again.", 401));
            }
        }
        // Grant access to protected route
        req.user = user;
        next();
    }
    catch (error) {
        logger_1.logger.error("Authentication error", error);
        next(new appError_1.AppError("Invalid token. Please log in again.", 401));
    }
});
exports.protect = protect;
const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new appError_1.AppError("You are not logged in", 401));
        }
        if (!roles.includes(req.user.role)) {
            return next(new appError_1.AppError("You do not have permission to perform this action", 403));
        }
        next();
    };
};
exports.restrictTo = restrictTo;
//# sourceMappingURL=auth.js.map