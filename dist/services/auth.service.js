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
exports.authService = void 0;
const client_1 = require("@prisma/client");
const appError_1 = require("../utils/appError");
const redis_service_1 = require("./redis.service");
const email_service_1 = require("./email.service");
const logger_1 = require("../utils/logger");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
const crypto_1 = __importDefault(require("crypto"));
const google_auth_library_1 = require("google-auth-library");
const prisma = new client_1.PrismaClient();
const googleClient = new google_auth_library_1.OAuth2Client(config_1.default.google.clientId);
// Temporary in-memory OTP store until Redis is fixed
// NOTE: This is NOT for production use - only a temporary development workaround
const tempOtpStore = {};
exports.authService = {
    /**
     * Create guest account with OTP verification
     * @param email User email
     * @returns Expiration time of OTP
     */
    createGuestAccount(email) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if user already exists
            const existingUser = yield prisma.user.findUnique({
                where: { email },
            });
            if (existingUser && !existingUser.isGuest) {
                throw new appError_1.AppError("Email already in use. Please use a different email or login.", 400);
            }
            // Generate OTP (6 digits)
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry
            // Hash OTP before storage
            const hashedOTP = crypto_1.default.createHash("sha256").update(otp).digest("hex");
            // Store OTP in temp store (fallback if Redis fails)
            const redisKey = `guest_otp_${email}`;
            tempOtpStore[redisKey] = {
                otp: hashedOTP,
                expires: expiresAt.getTime(),
            };
            // Log OTP for development debugging only (remove in production)
            logger_1.logger.debug(`Generated OTP for ${email}: ${otp} (hashed: ${hashedOTP})`);
            // Try Redis first, fall back to in-memory store
            try {
                const redisAvailable = yield redis_service_1.redisService.isConnected();
                if (redisAvailable) {
                    yield redis_service_1.redisService.set(redisKey, hashedOTP, 900 // 15 minutes in seconds
                    );
                    logger_1.logger.info(`Guest OTP stored in Redis: ${redisKey}`);
                    // Double-check storage
                    const stored = yield redis_service_1.redisService.get(redisKey);
                    if (stored) {
                        logger_1.logger.debug(`Verified Redis storage: ${redisKey}`);
                    }
                    else {
                        logger_1.logger.warn(`Failed to verify Redis storage for: ${redisKey}`);
                    }
                }
                else {
                    logger_1.logger.info(`Using in-memory OTP store only: ${redisKey}`);
                }
            }
            catch (error) {
                logger_1.logger.warn(`Redis unavailable, using in-memory OTP store: ${redisKey}`);
            }
            // Send OTP via email
            yield email_service_1.emailService.sendGuestOTPEmail(email, otp);
            logger_1.logger.info(`Guest account OTP sent to: ${email}`);
            return expiresAt;
        });
    },
    /**
     * Verify guest OTP and create guest user account
     * @param email User email
     * @param otp OTP code
     * @returns Guest user data
     */
    verifyGuestOTP(email, otp) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Log verification attempt for debugging
                logger_1.logger.debug(`Verifying OTP for ${email}: ${otp}`);
                // Get stored OTP - try Redis first, then fallback to in-memory store
                const redisKey = `guest_otp_${email}`;
                let storedHashedOTP = yield redis_service_1.redisService.get(redisKey);
                // Log Redis storage status
                logger_1.logger.debug(`Redis OTP for ${redisKey}: ${storedHashedOTP ? "Found" : "Not found"}`);
                // If not in Redis, check temp store
                if (!storedHashedOTP && tempOtpStore[redisKey]) {
                    logger_1.logger.debug(`Found OTP in memory store for: ${redisKey}`);
                    // Check if expired
                    if (tempOtpStore[redisKey].expires > Date.now()) {
                        storedHashedOTP = tempOtpStore[redisKey].otp;
                        logger_1.logger.info(`Using in-memory OTP store for verification: ${redisKey}`);
                    }
                    else {
                        // Clean up expired OTP
                        logger_1.logger.debug(`In-memory OTP expired: ${new Date(tempOtpStore[redisKey].expires).toISOString()}`);
                        delete tempOtpStore[redisKey];
                    }
                }
                if (!storedHashedOTP) {
                    logger_1.logger.warn(`No valid OTP found for ${redisKey}`);
                    throw new appError_1.AppError("OTP has expired or is invalid. Please request a new one.", 400);
                }
                // Hash provided OTP and compare
                const hashedOTP = crypto_1.default.createHash("sha256").update(otp).digest("hex");
                logger_1.logger.debug(`Comparing OTPs for ${email}: Provided (hashed): ${hashedOTP}, Stored: ${storedHashedOTP}`);
                if (storedHashedOTP !== hashedOTP) {
                    logger_1.logger.warn(`Invalid OTP for ${email}: doesn't match stored value`);
                    throw new appError_1.AppError("Invalid OTP. Please try again.", 400);
                }
                logger_1.logger.info(`OTP verified successfully for ${email}`);
                // Delete OTP after successful verification
                yield redis_service_1.redisService.del(redisKey);
                delete tempOtpStore[redisKey];
                // Check if user already exists
                let user = yield prisma.user.findUnique({
                    where: { email },
                });
                if (user && !user.isGuest) {
                    throw new appError_1.AppError("User already exists with this email. Please login instead.", 400);
                }
                if (!user) {
                    // Create guest user
                    user = yield prisma.user.create({
                        data: {
                            email,
                            isGuest: true,
                            isEmailVerified: true, // Email is verified through OTP
                            authProvider: "EMAIL",
                            status: "ACTIVE",
                        },
                    });
                    // Send welcome email
                    yield email_service_1.emailService.sendGuestWelcomeEmail(email, "Guest");
                }
                // Generate JWT token (not returned but could be used if needed)
                const token = this.signToken(user.id);
                logger_1.logger.info(`Guest user created: ${email}`);
                return {
                    id: user.id,
                    email: user.email,
                    isGuest: true,
                    token,
                };
            }
            catch (error) {
                logger_1.logger.error("Guest OTP verification error", error);
                throw error;
            }
        });
    },
    /**
     * Create verification token
     * @param userId User ID
     * @param type Token type
     * @returns Token string
     */
    createVerificationToken(userId, type) {
        return __awaiter(this, void 0, void 0, function* () {
            // Generate random token
            const token = crypto_1.default.randomBytes(32).toString("hex");
            // Set expiration (24 hours)
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);
            // Save token - use string for type
            yield prisma.verificationToken.create({
                data: {
                    token,
                    type: type.toString(), // Cast to handle type mismatch
                    expiresAt,
                    userId,
                },
            });
            return token;
        });
    },
    /**
     * Sign JWT token
     * @param userId User ID
     * @returns JWT token
     */
    signToken(userId) {
        return jsonwebtoken_1.default.sign({ id: userId }, config_1.default.jwtSecret, {
            expiresIn: config_1.default.jwtExpiresIn,
        });
    },
    /**
     * Verify JWT token
     * @param token JWT token
     * @returns Token payload
     */
    verifyToken(token) {
        return jsonwebtoken_1.default.verify(token, config_1.default.jwtSecret);
    },
    /**
     * Start OTP-based registration process
     * @param email User email
     * @returns Expiration time of OTP
     */
    registerWithOTP(email) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if user already exists
            const existingUser = yield prisma.user.findUnique({
                where: { email },
            });
            if (existingUser) {
                throw new appError_1.AppError("Email already in use. Please use a different email or login.", 400);
            }
            // Generate OTP (6 digits)
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry
            // Hash OTP before storage
            const hashedOTP = crypto_1.default.createHash("sha256").update(otp).digest("hex");
            // Store OTP in temp store and attempt to store in Redis
            const redisKey = `register_otp_${email}`;
            // Store in temp memory
            tempOtpStore[redisKey] = {
                otp: hashedOTP,
                expires: expiresAt.getTime(),
            };
            // Try Redis, but don't fail if unavailable
            try {
                const redisAvailable = yield redis_service_1.redisService.isConnected();
                if (redisAvailable) {
                    yield redis_service_1.redisService.set(redisKey, hashedOTP, 900 // 15 minutes in seconds
                    );
                    logger_1.logger.info(`Registration OTP stored in Redis: ${redisKey}`);
                }
                else {
                    logger_1.logger.info(`Using in-memory OTP store only: ${redisKey}`);
                }
            }
            catch (error) {
                logger_1.logger.warn(`Redis unavailable, using in-memory OTP store: ${redisKey}`);
            }
            // Send OTP via email
            yield email_service_1.emailService.sendRegistrationOTPEmail(email, otp);
            logger_1.logger.info(`Registration OTP sent to: ${email}`);
            return expiresAt;
        });
    },
    /**
     * Verify OTP and complete registration
     * @param email User email
     * @param otp OTP code
     * @param firstName User first name
     * @param lastName User last name
     * @param phone Optional user phone number
     * @returns Created user and token
     */
    verifyOTPAndRegister(email, otp, firstName, lastName, phone) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.logger.info(`Attempting to verify registration OTP for email: ${email}`);
                // Get stored OTP - try Redis first, then fallback to in-memory store
                const redisKey = `register_otp_${email}`;
                let storedHashedOTP = yield redis_service_1.redisService.get(redisKey);
                // If not in Redis, check temp store
                if (!storedHashedOTP && tempOtpStore[redisKey]) {
                    // Check if expired
                    if (tempOtpStore[redisKey].expires > Date.now()) {
                        storedHashedOTP = tempOtpStore[redisKey].otp;
                        logger_1.logger.info(`Using in-memory OTP store for verification: ${redisKey}`);
                    }
                    else {
                        // Clean up expired OTP
                        delete tempOtpStore[redisKey];
                        logger_1.logger.warn(`OTP from in-memory store expired: ${redisKey}`);
                    }
                }
                if (!storedHashedOTP) {
                    logger_1.logger.warn(`No OTP found for key: ${redisKey}`);
                    throw new appError_1.AppError("OTP has expired or is invalid. Please request a new one.", 400);
                }
                logger_1.logger.info(`Found stored OTP for verification. Redis key: ${redisKey}`);
                // Hash provided OTP and compare
                const hashedOTP = crypto_1.default.createHash("sha256").update(otp).digest("hex");
                if (storedHashedOTP !== hashedOTP) {
                    logger_1.logger.warn(`OTP verification failed. Provided OTP doesn't match stored OTP for email: ${email}`);
                    throw new appError_1.AppError("Invalid OTP. Please try again.", 400);
                }
                logger_1.logger.info(`OTP verification successful for email: ${email}`);
                // Delete OTP after successful verification
                try {
                    yield redis_service_1.redisService.del(redisKey);
                }
                catch (error) {
                    logger_1.logger.warn(`Error deleting OTP from Redis: ${error}`);
                }
                // Also delete from temp store
                delete tempOtpStore[redisKey];
                logger_1.logger.info(`OTP removed from stores for key: ${redisKey}`);
                // Check if user exists
                const existingUser = yield prisma.user.findUnique({
                    where: { email },
                });
                if (existingUser && !existingUser.isGuest) {
                    throw new appError_1.AppError("User with this email already exists.", 400);
                }
                let user;
                if (existingUser && existingUser.isGuest) {
                    // Upgrade guest user to regular user
                    user = yield prisma.user.update({
                        where: { id: existingUser.id },
                        data: {
                            name: `${firstName} ${lastName}`,
                            phone,
                            isGuest: false,
                            isEmailVerified: true,
                            lastLoginAt: new Date(),
                        },
                    });
                    logger_1.logger.info(`Guest user upgraded to regular user: ${email}`);
                }
                else {
                    // Create new user
                    user = yield prisma.user.create({
                        data: {
                            email,
                            name: `${firstName} ${lastName}`,
                            phone,
                            isEmailVerified: true,
                            authProvider: "EMAIL",
                            status: "ACTIVE",
                        },
                    });
                    logger_1.logger.info(`New user created after OTP verification: ${email}`);
                }
                // Generate JWT token
                const token = this.signToken(user.id);
                logger_1.logger.info(`User registered successfully, token generated: ${email}`);
                return { user: user, token };
            }
            catch (error) {
                logger_1.logger.error("Registration OTP verification error", error);
                throw error;
            }
        });
    },
    /**
     * Start OTP-based login process
     * @param email User email
     * @returns Expiration time of OTP
     */
    loginWithOTP(email) {
        return __awaiter(this, void 0, void 0, function* () {
            // Find user first
            const user = yield prisma.user.findUnique({
                where: { email },
            });
            if (!user) {
                // Security: Still return a valid response even if user doesn't exist
                // to prevent user enumeration attacks
                logger_1.logger.info(`Login OTP requested for non-existent user: ${email}`);
                const fakeExpiryTime = new Date(Date.now() + 15 * 60 * 1000);
                return fakeExpiryTime;
            }
            // Generate OTP (6 digits)
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry
            // Hash OTP before storage
            const hashedOTP = crypto_1.default.createHash("sha256").update(otp).digest("hex");
            // Store OTP in temp store and attempt to store in Redis
            const redisKey = `login_otp_${email}`;
            // Store in temp memory
            tempOtpStore[redisKey] = {
                otp: hashedOTP,
                expires: expiresAt.getTime(),
            };
            try {
                yield redis_service_1.redisService.set(redisKey, hashedOTP, 900 // 15 minutes in seconds
                );
                logger_1.logger.info(`Login OTP stored in Redis with key: ${redisKey}`);
            }
            catch (error) {
                logger_1.logger.warn(`Redis unavailable, using in-memory OTP store: ${redisKey}`);
            }
            // Send OTP via email
            yield email_service_1.emailService.sendOTPEmail(email, otp, user.name || "");
            logger_1.logger.info(`Login OTP sent to: ${email}`);
            return expiresAt;
        });
    },
    /**
     * Verify OTP and complete login
     * @param email User email
     * @param otp The OTP code
     * @returns User and token
     */
    verifyOTPAndLogin(email, otp) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.logger.info(`Attempting to verify login OTP for email: ${email}`);
                // Get stored OTP - try Redis first, then fallback to in-memory store
                const redisKey = `login_otp_${email}`;
                let storedHashedOTP = yield redis_service_1.redisService.get(redisKey);
                // If not in Redis, check temp store
                if (!storedHashedOTP && tempOtpStore[redisKey]) {
                    // Check if expired
                    if (tempOtpStore[redisKey].expires > Date.now()) {
                        storedHashedOTP = tempOtpStore[redisKey].otp;
                        logger_1.logger.info(`Using in-memory OTP store for login verification: ${redisKey}`);
                    }
                    else {
                        // Clean up expired OTP
                        delete tempOtpStore[redisKey];
                        logger_1.logger.warn(`Login OTP from in-memory store expired: ${redisKey}`);
                    }
                }
                if (!storedHashedOTP) {
                    logger_1.logger.warn(`No OTP found for login key: ${redisKey}`);
                    throw new appError_1.AppError("OTP has expired or is invalid. Please request a new one.", 400);
                }
                logger_1.logger.info(`Found stored login OTP for verification. Key: ${redisKey}`);
                // Hash provided OTP and compare
                const hashedOTP = crypto_1.default.createHash("sha256").update(otp).digest("hex");
                if (storedHashedOTP !== hashedOTP) {
                    logger_1.logger.warn(`Login OTP verification failed. Provided OTP doesn't match stored OTP for email: ${email}`);
                    throw new appError_1.AppError("Invalid OTP. Please try again.", 400);
                }
                logger_1.logger.info(`Login OTP verification successful for email: ${email}`);
                // Delete OTP after successful verification
                try {
                    yield redis_service_1.redisService.del(redisKey);
                }
                catch (error) {
                    logger_1.logger.warn(`Error deleting login OTP from Redis: ${error}`);
                }
                // Also delete from temp store
                delete tempOtpStore[redisKey];
                logger_1.logger.info(`Login OTP removed from stores for key: ${redisKey}`);
                // Find user
                const user = yield prisma.user.findUnique({
                    where: { email },
                });
                if (!user) {
                    throw new appError_1.AppError("User not found", 404);
                }
                // Update last login time
                const updatedUser = yield prisma.user.update({
                    where: { id: user.id },
                    data: { lastLoginAt: new Date() },
                });
                // Generate JWT token
                const token = this.signToken(updatedUser.id);
                logger_1.logger.info(`User logged in successfully via OTP: ${email}`);
                return { user: updatedUser, token };
            }
            catch (error) {
                logger_1.logger.error(`OTP verification error for ${email}`, error);
                throw error;
            }
        });
    },
    /**
     * Upgrade a guest user to a regular user
     * @param email User email
     * @param firstName First name
     * @param lastName Last name
     * @param phone Optional phone number
     * @returns Updated user and token
     */
    upgradeGuestUser(email, firstName, lastName, phone) {
        return __awaiter(this, void 0, void 0, function* () {
            // Find existing guest user
            const user = yield prisma.user.findUnique({
                where: { email },
            });
            if (!user) {
                throw new appError_1.AppError("Guest account not found. Please create a guest account first.", 404);
            }
            if (!user.isGuest) {
                throw new appError_1.AppError("User is already a registered user", 400);
            }
            // Update user to regular user
            yield prisma.user.update({
                where: { id: user.id },
                data: {
                    name: `${firstName} ${lastName}`,
                    phone,
                    isGuest: false,
                    lastLoginAt: new Date(),
                },
            });
            // Fetch the updated user
            const updatedUser = yield prisma.user.findUnique({
                where: { id: user.id },
            });
            // Generate JWT token
            const token = this.signToken(user.id);
            logger_1.logger.info(`Guest user upgraded to registered user: ${email}`);
            return { user: updatedUser, token };
        });
    },
    /**
     * Authenticate with Google
     * @param googleIdToken Google ID token
     * @returns User and token
     */
    googleAuth(googleIdToken) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Verify Google token
                const ticket = yield googleClient.verifyIdToken({
                    idToken: googleIdToken,
                    audience: config_1.default.google.clientId,
                });
                const payload = ticket.getPayload();
                if (!payload || !payload.email) {
                    throw new appError_1.AppError("Invalid Google token", 400);
                }
                const { email, name, given_name, family_name, sub } = payload;
                // Check if user exists
                let user = yield prisma.user.findUnique({
                    where: { email },
                });
                let userId;
                if (user) {
                    // Update existing user standard fields
                    yield prisma.user.update({
                        where: { id: user.id },
                        data: {
                            name: name || user.name,
                            isEmailVerified: true,
                            isGuest: false,
                            lastLoginAt: new Date(),
                        },
                    });
                    // Update Google fields using executeRaw
                    yield prisma.$executeRaw `
          UPDATE "users" 
          SET "googleId" = ${sub}, "authProvider" = 'GOOGLE' 
          WHERE "id" = ${user.id}
        `;
                    userId = user.id;
                }
                else {
                    // Create new user with standard fields
                    const newUser = yield prisma.user.create({
                        data: {
                            email,
                            name: name || `${given_name} ${family_name}`,
                            isEmailVerified: true,
                            lastLoginAt: new Date(),
                        }, // Type cast to bypass TypeScript checking
                    });
                    // Update Google fields using executeRaw
                    yield prisma.$executeRaw `
          UPDATE "users" 
          SET "googleId" = ${sub}, "authProvider" = 'GOOGLE' 
          WHERE "id" = ${newUser.id}
        `;
                    userId = newUser.id;
                }
                // Fetch the updated user
                user = yield prisma.user.findUnique({
                    where: { id: userId },
                });
                // Generate JWT token
                const token = this.signToken(userId);
                logger_1.logger.info(`User authenticated via Google: ${email}`);
                return { user: user, token };
            }
            catch (error) {
                logger_1.logger.error("Google authentication error", error);
                throw new appError_1.AppError("Failed to authenticate with Google", 400);
            }
        });
    },
};
//# sourceMappingURL=auth.service.js.map