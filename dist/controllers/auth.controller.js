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
exports.authController = void 0;
const auth_service_1 = require("../services/auth.service");
const device_service_1 = require("../services/device.service");
const appError_1 = require("../utils/appError");
const validator_1 = require("../utils/validator");
const zod_1 = require("zod");
const config_1 = __importDefault(require("../config"));
const redis_service_1 = require("../services/redis.service");
const logger_1 = require("../utils/logger");
exports.authController = {
    /**
     * Send OTP for registration
     */
    registerOTP(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate request body
                const schema = zod_1.z.object({
                    email: zod_1.z.string().email("Invalid email address"),
                });
                const validatedData = (0, validator_1.validateRequest)(req.body, schema);
                // Request OTP for registration
                const expiresAt = yield auth_service_1.authService.registerWithOTP(validatedData.email);
                // Return response
                res.status(200).json({
                    status: "success",
                    message: "OTP sent to your email for verification",
                    data: {
                        expiresAt,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        });
    },
    /**
     * Verify OTP and complete registration
     */
    verifyOTP(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate request body
                const schema = zod_1.z.object({
                    email: zod_1.z.string().email("Invalid email address"),
                    otp: zod_1.z.string().length(6, "OTP must be 6 digits"),
                    firstName: zod_1.z
                        .string()
                        .min(2, "First name must be at least 2 characters"),
                    lastName: zod_1.z.string().min(2, "Last name must be at least 2 characters"),
                    phone: zod_1.z.string().optional(),
                });
                const validatedData = (0, validator_1.validateRequest)(req.body, schema);
                // Test Redis connection
                const redisConnected = yield redis_service_1.redisService.testConnection();
                if (!redisConnected) {
                    return res.status(503).json({
                        status: "error",
                        message: "Service temporarily unavailable. Please try again later.",
                        retryAfter: 30, // Suggest retry after 30 seconds
                    });
                }
                // Verify OTP and register/login user
                const { user, token } = yield auth_service_1.authService.verifyOTPAndRegister(validatedData.email, validatedData.otp, validatedData.firstName, validatedData.lastName, validatedData.phone);
                // Track device
                const deviceFingerprint = device_service_1.deviceService.generateFingerprint(req);
                yield device_service_1.deviceService.checkAndTrackDevice(user.id, deviceFingerprint, user.email, user.name || `${validatedData.firstName} ${validatedData.lastName}`, req);
                // Set cookie
                const cookieOptions = {
                    expires: new Date(Date.now() + config_1.default.jwtCookieExpiresIn * 24 * 60 * 60 * 1000),
                    httpOnly: true,
                    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
                    sameSite: "strict",
                };
                res.cookie("jwt", token, cookieOptions);
                // Return response
                res.status(200).json({
                    status: "success",
                    message: "Registration successful.",
                    token,
                    data: {
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            isGuest: user.isGuest,
                        },
                    },
                });
            }
            catch (error) {
                // Handle specific OTP errors with friendly messages
                if (error instanceof appError_1.AppError) {
                    if (error.message.includes("OTP has expired")) {
                        return res.status(400).json({
                            status: "error",
                            message: "Verification code has expired. Please request a new one.",
                            code: "OTP_EXPIRED",
                        });
                    }
                    if (error.message.includes("Invalid OTP")) {
                        return res.status(400).json({
                            status: "error",
                            message: "Incorrect verification code. Please try again.",
                            code: "OTP_INVALID",
                        });
                    }
                }
                next(error);
            }
        });
    },
    /**
     * Send OTP for login
     */
    loginOTP(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate request body
                const schema = zod_1.z.object({
                    email: zod_1.z.string().email("Invalid email address"),
                });
                const validatedData = (0, validator_1.validateRequest)(req.body, schema);
                // Request OTP for login
                const expiresAt = yield auth_service_1.authService.loginWithOTP(validatedData.email);
                // Return response
                res.status(200).json({
                    status: "success",
                    message: "OTP sent to your email for login",
                    data: {
                        expiresAt,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        });
    },
    /**
     * Verify login OTP
     */
    verifyLoginOTP(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate request body
                const schema = zod_1.z.object({
                    email: zod_1.z.string().email("Invalid email address"),
                    otp: zod_1.z.string().length(6, "OTP must be 6 digits"),
                });
                const validatedData = (0, validator_1.validateRequest)(req.body, schema);
                // Test Redis connection
                const redisConnected = yield redis_service_1.redisService.testConnection();
                if (!redisConnected) {
                    return res.status(503).json({
                        status: "error",
                        message: "Service temporarily unavailable. Please try again later.",
                        retryAfter: 30, // Suggest retry after 30 seconds
                    });
                }
                // Verify OTP and login user
                const { user, token } = yield auth_service_1.authService.verifyOTPAndLogin(validatedData.email, validatedData.otp);
                // Track device
                const deviceFingerprint = device_service_1.deviceService.generateFingerprint(req);
                yield device_service_1.deviceService.checkAndTrackDevice(user.id, deviceFingerprint, user.email, user.name || "", req);
                // Set cookie
                const cookieOptions = {
                    expires: new Date(Date.now() + config_1.default.jwtCookieExpiresIn * 24 * 60 * 60 * 1000),
                    httpOnly: true,
                    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
                    sameSite: "strict",
                };
                res.cookie("jwt", token, cookieOptions);
                // Return response
                res.status(200).json({
                    status: "success",
                    message: "Login successful.",
                    token,
                    data: {
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            isGuest: user.isGuest,
                        },
                    },
                });
            }
            catch (error) {
                // Handle specific OTP errors with friendly messages
                if (error instanceof appError_1.AppError) {
                    if (error.message.includes("OTP has expired")) {
                        return res.status(400).json({
                            status: "error",
                            message: "Verification code has expired. Please request a new one.",
                            code: "OTP_EXPIRED",
                        });
                    }
                    if (error.message.includes("Invalid OTP")) {
                        return res.status(400).json({
                            status: "error",
                            message: "Incorrect verification code. Please try again.",
                            code: "OTP_INVALID",
                        });
                    }
                }
                next(error);
            }
        });
    },
    /**
     * Authenticate with Google
     */
    googleAuth(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate request body
                const schema = zod_1.z.object({
                    idToken: zod_1.z.string(),
                });
                const validatedData = (0, validator_1.validateRequest)(req.body, schema);
                // Authenticate with Google
                const { user, token } = yield auth_service_1.authService.googleAuth(validatedData.idToken);
                // Track device
                const deviceFingerprint = device_service_1.deviceService.generateFingerprint(req);
                yield device_service_1.deviceService.checkAndTrackDevice(user.id, deviceFingerprint, user.email, user.name || "", req);
                // Set cookie
                const cookieOptions = {
                    expires: new Date(Date.now() + config_1.default.jwtCookieExpiresIn * 24 * 60 * 60 * 1000),
                    httpOnly: true,
                    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
                    sameSite: "strict",
                };
                res.cookie("jwt", token, cookieOptions);
                // Return response
                res.status(200).json({
                    status: "success",
                    message: "Google authentication successful.",
                    token,
                    data: {
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            isGuest: user.isGuest,
                        },
                    },
                });
            }
            catch (error) {
                next(error);
            }
        });
    },
    logout(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            res.cookie("jwt", "loggedout", {
                expires: new Date(Date.now() + 10 * 1000),
                httpOnly: true,
                secure: req.secure || req.headers["x-forwarded-proto"] === "https",
                sameSite: "strict",
            });
            res.status(200).json({
                status: "success",
                message: "Logged out successfully",
            });
        });
    },
    /**
     * Create guest account with OTP
     * @route POST /auth/guest
     * @access Public
     */
    createGuestAccount(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email } = req.body;
                if (!email) {
                    throw new appError_1.AppError("Email is required", 400);
                }
                const expiresAt = yield auth_service_1.authService.createGuestAccount(email);
                res.status(200).json({
                    status: "success",
                    message: "OTP sent to email for guest account creation",
                    data: { expiresAt },
                });
            }
            catch (error) {
                next(error);
            }
        });
    },
    /**
     * Verify OTP and create guest account
     * @route POST /auth/verify-guest
     * @access Public
     */
    verifyGuestOTP(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, otp } = req.body;
                if (!email || !otp) {
                    throw new appError_1.AppError("Email and OTP are required", 400);
                }
                // Log the received inputs for debugging
                logger_1.logger.debug(`Verifying guest OTP for ${email} with code: ${otp}`);
                // Check Redis connection status for debugging
                const redisConnected = yield redis_service_1.redisService.isConnected();
                logger_1.logger.debug(`Redis connection status: ${redisConnected ? "Connected" : "Disconnected"}`);
                // Attempt Redis lookup for debugging
                const redisKey = `guest_otp_${email}`;
                const redisOTP = yield redis_service_1.redisService.get(redisKey);
                logger_1.logger.debug(`Redis OTP for ${redisKey}: ${redisOTP ? "Exists" : "Not found"}`);
                const user = yield auth_service_1.authService.verifyGuestOTP(email, otp);
                res.status(200).json({
                    status: "success",
                    message: "Guest account created successfully",
                    data: { user },
                });
            }
            catch (error) {
                next(error);
            }
        });
    },
    /**
     * Upgrade guest account to full user account
     * @route POST /auth/upgrade-guest
     * @access Public
     */
    upgradeGuestAccount(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, firstName, lastName, phone } = req.body;
                if (!email || !firstName || !lastName) {
                    throw new appError_1.AppError("Email, first name, and last name are required", 400);
                }
                const { user, token } = yield auth_service_1.authService.upgradeGuestUser(email, firstName, lastName, phone);
                // Create a sanitized user object without sensitive information
                const sanitizedUser = {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    phone: user.phone,
                    isGuest: user.isGuest,
                    isEmailVerified: user.isEmailVerified,
                    isPhoneVerified: user.isPhoneVerified,
                    role: user.role,
                    status: user.status,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                    lastLoginAt: user.lastLoginAt,
                };
                res.status(200).json({
                    status: "success",
                    message: "Guest account upgraded to full user account successfully",
                    token,
                    data: { user: sanitizedUser },
                });
            }
            catch (error) {
                next(error);
            }
        });
    },
};
//# sourceMappingURL=auth.controller.js.map