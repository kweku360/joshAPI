import { PrismaClient, Role, UserStatus, TokenType } from "@prisma/client";
import { IUser, IGuestUser, AuthProvider } from "../interfaces/user.interface";
import { AppError } from "../utils/appError";
import { redisService } from "./redis.service";
import { emailService } from "./email.service";
import { logger } from "../utils/logger";
import jwt from "jsonwebtoken";
import config from "../config";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(config.google.clientId);

// Temporary in-memory OTP store until Redis is fixed
// NOTE: This is NOT for production use - only a temporary development workaround
const tempOtpStore: Record<string, { otp: string; expires: number }> = {};

export const authService = {
  /**
   * Create guest account with OTP verification
   * @param email User email
   * @returns Expiration time of OTP
   */
  async createGuestAccount(email: string): Promise<Date> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && !existingUser.isGuest) {
      throw new AppError(
        "Email already in use. Please use a different email or login.",
        400
      );
    }

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Hash OTP before storage
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    // Store OTP in temp store (fallback if Redis fails)
    const redisKey = `guest_otp_${email}`;
    tempOtpStore[redisKey] = {
      otp: hashedOTP,
      expires: expiresAt.getTime(),
    };

    // Log OTP for development debugging only (remove in production)
    logger.debug(`Generated OTP for ${email}: ${otp} (hashed: ${hashedOTP})`);

    // Try Redis first, fall back to in-memory store
    try {
      const redisAvailable = await redisService.isConnected();
      if (redisAvailable) {
    await redisService.set(
          redisKey,
      hashedOTP,
      900 // 15 minutes in seconds
    );
        logger.info(`Guest OTP stored in Redis: ${redisKey}`);

        // Double-check storage
        const stored = await redisService.get<string>(redisKey);
        if (stored) {
          logger.debug(`Verified Redis storage: ${redisKey}`);
        } else {
          logger.warn(`Failed to verify Redis storage for: ${redisKey}`);
        }
      } else {
        logger.info(`Using in-memory OTP store only: ${redisKey}`);
      }
    } catch (error) {
      logger.warn(`Redis unavailable, using in-memory OTP store: ${redisKey}`);
    }

    // Send OTP via email
    await emailService.sendGuestOTPEmail(email, otp);

    logger.info(`Guest account OTP sent to: ${email}`);

    return expiresAt;
  },

  /**
   * Verify guest OTP and create guest user account
   * @param email User email
   * @param otp OTP code
   * @returns Guest user data
   */
  async verifyGuestOTP(email: string, otp: string): Promise<IGuestUser> {
    try {
      // Log verification attempt for debugging
      logger.debug(`Verifying OTP for ${email}: ${otp}`);

      // Get stored OTP - try Redis first, then fallback to in-memory store
      const redisKey = `guest_otp_${email}`;
      let storedHashedOTP = await redisService.get<string>(redisKey);

      // Log Redis storage status
      logger.debug(
        `Redis OTP for ${redisKey}: ${storedHashedOTP ? "Found" : "Not found"}`
      );

      // If not in Redis, check temp store
      if (!storedHashedOTP && tempOtpStore[redisKey]) {
        logger.debug(`Found OTP in memory store for: ${redisKey}`);

        // Check if expired
        if (tempOtpStore[redisKey].expires > Date.now()) {
          storedHashedOTP = tempOtpStore[redisKey].otp;
          logger.info(
            `Using in-memory OTP store for verification: ${redisKey}`
          );
        } else {
          // Clean up expired OTP
          logger.debug(
            `In-memory OTP expired: ${new Date(tempOtpStore[redisKey].expires).toISOString()}`
          );
          delete tempOtpStore[redisKey];
        }
      }

      if (!storedHashedOTP) {
        logger.warn(`No valid OTP found for ${redisKey}`);
        throw new AppError(
          "OTP has expired or is invalid. Please request a new one.",
          400
        );
      }

      // Hash provided OTP and compare
      const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
      logger.debug(
        `Comparing OTPs for ${email}: Provided (hashed): ${hashedOTP}, Stored: ${storedHashedOTP}`
      );

      if (storedHashedOTP !== hashedOTP) {
        logger.warn(`Invalid OTP for ${email}: doesn't match stored value`);
        throw new AppError("Invalid OTP. Please try again.", 400);
      }

      logger.info(`OTP verified successfully for ${email}`);

      // Delete OTP after successful verification
      await redisService.del(redisKey);
      delete tempOtpStore[redisKey];

      // Check if user already exists
      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (user && !user.isGuest) {
        throw new AppError(
          "User already exists with this email. Please login instead.",
          400
        );
      }

      if (!user) {
        // Create guest user
        user = await prisma.user.create({
          data: {
            email,
            isGuest: true,
            isEmailVerified: true, // Email is verified through OTP
            authProvider: "EMAIL",
            status: "ACTIVE",
          },
        });

        // Send welcome email
        await emailService.sendGuestWelcomeEmail(email, "Guest");
      }

      // Generate JWT token (not returned but could be used if needed)
      const token = this.signToken(user.id);

      logger.info(`Guest user created: ${email}`);

      return {
        id: user.id,
        email: user.email,
        isGuest: true,
        token,
      };
    } catch (error) {
      logger.error("Guest OTP verification error", error);
      throw error;
    }
  },

  /**
   * Create verification token
   * @param userId User ID
   * @param type Token type
   * @returns Token string
   */
  async createVerificationToken(
    userId: string,
    type: TokenType
  ): Promise<string> {
    // Generate random token
    const token = crypto.randomBytes(32).toString("hex");

    // Set expiration (24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Save token - use string for type
    await prisma.verificationToken.create({
      data: {
        token,
        type: type.toString() as any, // Cast to handle type mismatch
        expiresAt,
        userId,
      },
    });

    return token;
  },

  /**
   * Sign JWT token
   * @param userId User ID
   * @returns JWT token
   */
  signToken(userId: string): string {
    return jwt.sign({ id: userId }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    } as any);
  },

  /**
   * Verify JWT token
   * @param token JWT token
   * @returns Token payload
   */
  verifyToken(token: string): { id: string; iat: number } {
    return jwt.verify(token, config.jwtSecret) as { id: string; iat: number };
  },

  /**
   * Start OTP-based registration process
   * @param email User email
   * @returns Expiration time of OTP
   */
  async registerWithOTP(email: string): Promise<Date> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError(
        "Email already in use. Please use a different email or login.",
        400
      );
    }

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Hash OTP before storage
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    // Store OTP in temp store and attempt to store in Redis
    const redisKey = `register_otp_${email}`;

    // Store in temp memory
    tempOtpStore[redisKey] = {
      otp: hashedOTP,
      expires: expiresAt.getTime(),
    };

    // Try Redis, but don't fail if unavailable
    try {
      const redisAvailable = await redisService.isConnected();
      if (redisAvailable) {
    await redisService.set(
          redisKey,
      hashedOTP,
      900 // 15 minutes in seconds
    );
        logger.info(`Registration OTP stored in Redis: ${redisKey}`);
      } else {
        logger.info(`Using in-memory OTP store only: ${redisKey}`);
      }
    } catch (error) {
      logger.warn(`Redis unavailable, using in-memory OTP store: ${redisKey}`);
    }

    // Send OTP via email
    await emailService.sendRegistrationOTPEmail(email, otp);

    logger.info(`Registration OTP sent to: ${email}`);

    return expiresAt;
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
  async verifyOTPAndRegister(
    email: string,
    otp: string,
    firstName: string,
    lastName: string,
    phone?: string
  ): Promise<{ user: IUser; token: string }> {
    try {
      logger.info(`Attempting to verify registration OTP for email: ${email}`);

      // Get stored OTP - try Redis first, then fallback to in-memory store
      const redisKey = `register_otp_${email}`;
      let storedHashedOTP = await redisService.get<string>(redisKey);

      // If not in Redis, check temp store
      if (!storedHashedOTP && tempOtpStore[redisKey]) {
        // Check if expired
        if (tempOtpStore[redisKey].expires > Date.now()) {
          storedHashedOTP = tempOtpStore[redisKey].otp;
          logger.info(
            `Using in-memory OTP store for verification: ${redisKey}`
          );
        } else {
          // Clean up expired OTP
          delete tempOtpStore[redisKey];
          logger.warn(`OTP from in-memory store expired: ${redisKey}`);
        }
      }

      if (!storedHashedOTP) {
        logger.warn(`No OTP found for key: ${redisKey}`);
        throw new AppError(
          "OTP has expired or is invalid. Please request a new one.",
          400
        );
      }

      logger.info(`Found stored OTP for verification. Redis key: ${redisKey}`);

      // Hash provided OTP and compare
      const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
      if (storedHashedOTP !== hashedOTP) {
        logger.warn(
          `OTP verification failed. Provided OTP doesn't match stored OTP for email: ${email}`
        );
        throw new AppError("Invalid OTP. Please try again.", 400);
      }

      logger.info(`OTP verification successful for email: ${email}`);

      // Delete OTP after successful verification
      try {
      await redisService.del(redisKey);
      } catch (error) {
        logger.warn(`Error deleting OTP from Redis: ${error}`);
      }

      // Also delete from temp store
      delete tempOtpStore[redisKey];
      logger.info(`OTP removed from stores for key: ${redisKey}`);

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser && !existingUser.isGuest) {
        throw new AppError("User with this email already exists.", 400);
      }

      let user;
      if (existingUser && existingUser.isGuest) {
        // Upgrade guest user to regular user
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: `${firstName} ${lastName}`,
            phone,
            isGuest: false,
            isEmailVerified: true,
            lastLoginAt: new Date(),
          },
        });
        logger.info(`Guest user upgraded to regular user: ${email}`);
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            email,
            name: `${firstName} ${lastName}`,
            phone,
            isEmailVerified: true,
            authProvider: "EMAIL",
            status: "ACTIVE",
          },
        });
        logger.info(`New user created after OTP verification: ${email}`);
      }

      // Generate JWT token
      const token = this.signToken(user.id);

      logger.info(`User registered successfully, token generated: ${email}`);

      return { user: user as IUser, token };
    } catch (error) {
      logger.error("Registration OTP verification error", error);
      throw error;
    }
  },

  /**
   * Start OTP-based login process
   * @param email User email
   * @returns Expiration time of OTP
   */
  async loginWithOTP(email: string): Promise<Date> {
    // Find user first
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Security: Still return a valid response even if user doesn't exist
      // to prevent user enumeration attacks
      logger.info(`Login OTP requested for non-existent user: ${email}`);
      const fakeExpiryTime = new Date(Date.now() + 15 * 60 * 1000);
      return fakeExpiryTime;
    }

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Hash OTP before storage
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    // Store OTP in temp store and attempt to store in Redis
    const redisKey = `login_otp_${email}`;

    // Store in temp memory
    tempOtpStore[redisKey] = {
      otp: hashedOTP,
      expires: expiresAt.getTime(),
    };

    try {
    await redisService.set(
        redisKey,
      hashedOTP,
      900 // 15 minutes in seconds
    );
      logger.info(`Login OTP stored in Redis with key: ${redisKey}`);
    } catch (error) {
      logger.warn(`Redis unavailable, using in-memory OTP store: ${redisKey}`);
    }

    // Send OTP via email
    await emailService.sendOTPEmail(email, otp, user.name || "");

    logger.info(`Login OTP sent to: ${email}`);

    return expiresAt;
  },

  /**
   * Verify OTP and complete login
   * @param email User email
   * @param otp The OTP code
   * @returns User and token
   */
  async verifyOTPAndLogin(
    email: string,
    otp: string
  ): Promise<{ user: IUser; token: string }> {
    try {
      logger.info(`Attempting to verify login OTP for email: ${email}`);

      // Get stored OTP - try Redis first, then fallback to in-memory store
      const redisKey = `login_otp_${email}`;
      let storedHashedOTP = await redisService.get<string>(redisKey);

      // If not in Redis, check temp store
      if (!storedHashedOTP && tempOtpStore[redisKey]) {
        // Check if expired
        if (tempOtpStore[redisKey].expires > Date.now()) {
          storedHashedOTP = tempOtpStore[redisKey].otp;
          logger.info(
            `Using in-memory OTP store for login verification: ${redisKey}`
          );
        } else {
          // Clean up expired OTP
          delete tempOtpStore[redisKey];
          logger.warn(`Login OTP from in-memory store expired: ${redisKey}`);
        }
      }

      if (!storedHashedOTP) {
        logger.warn(`No OTP found for login key: ${redisKey}`);
        throw new AppError(
          "OTP has expired or is invalid. Please request a new one.",
          400
        );
      }

      logger.info(`Found stored login OTP for verification. Key: ${redisKey}`);

      // Hash provided OTP and compare
      const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
      if (storedHashedOTP !== hashedOTP) {
        logger.warn(
          `Login OTP verification failed. Provided OTP doesn't match stored OTP for email: ${email}`
        );
        throw new AppError("Invalid OTP. Please try again.", 400);
      }

      logger.info(`Login OTP verification successful for email: ${email}`);

      // Delete OTP after successful verification
      try {
      await redisService.del(redisKey);
      } catch (error) {
        logger.warn(`Error deleting login OTP from Redis: ${error}`);
      }

      // Also delete from temp store
      delete tempOtpStore[redisKey];
      logger.info(`Login OTP removed from stores for key: ${redisKey}`);

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Update last login time
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Generate JWT token
      const token = this.signToken(updatedUser.id);

      logger.info(`User logged in successfully via OTP: ${email}`);

      return { user: updatedUser as IUser, token };
    } catch (error) {
      logger.error(`OTP verification error for ${email}`, error);
      throw error;
    }
  },

  /**
   * Upgrade a guest user to a regular user
   * @param email User email
   * @param firstName First name
   * @param lastName Last name
   * @param phone Optional phone number
   * @returns Updated user and token
   */
  async upgradeGuestUser(
    email: string,
    firstName: string,
    lastName: string,
    phone?: string
  ): Promise<{ user: IUser; token: string }> {
    // Find existing guest user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError(
        "Guest account not found. Please create a guest account first.",
        404
      );
    }

    if (!user.isGuest) {
      throw new AppError("User is already a registered user", 400);
    }

    // Update user to regular user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: `${firstName} ${lastName}`,
        phone,
        isGuest: false,
        lastLoginAt: new Date(),
      },
    });

    // Fetch the updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    // Generate JWT token
    const token = this.signToken(user.id);

    logger.info(`Guest user upgraded to registered user: ${email}`);

    return { user: updatedUser as IUser, token };
  },

  /**
   * Authenticate with Google
   * @param googleIdToken Google ID token
   * @returns User and token
   */
  async googleAuth(
    googleIdToken: string
  ): Promise<{ user: IUser; token: string }> {
    try {
      // Verify Google token
      const ticket = await googleClient.verifyIdToken({
        idToken: googleIdToken,
        audience: config.google.clientId,
      });

      const payload = ticket.getPayload();

      if (!payload || !payload.email) {
        throw new AppError("Invalid Google token", 400);
      }

      const { email, name, given_name, family_name, sub } = payload;

      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { email },
      });

      let userId;

      if (user) {
        // Update existing user standard fields
        await prisma.user.update({
          where: { id: user.id },
          data: {
            name: name || user.name,
            isEmailVerified: true,
            isGuest: false,
            lastLoginAt: new Date(),
          },
        });

        // Update Google fields using executeRaw
        await prisma.$executeRaw`
          UPDATE "users" 
          SET "googleId" = ${sub}, "authProvider" = 'GOOGLE' 
          WHERE "id" = ${user.id}
        `;

        userId = user.id;
      } else {
        // Create new user with standard fields
        const newUser = await prisma.user.create({
          data: {
            email,
            name: name || `${given_name} ${family_name}`,
            isEmailVerified: true,
            lastLoginAt: new Date(),
          } as any, // Type cast to bypass TypeScript checking
        });

        // Update Google fields using executeRaw
        await prisma.$executeRaw`
          UPDATE "users" 
          SET "googleId" = ${sub}, "authProvider" = 'GOOGLE' 
          WHERE "id" = ${newUser.id}
        `;

        userId = newUser.id;
      }

      // Fetch the updated user
      user = await prisma.user.findUnique({
        where: { id: userId },
      });

      // Generate JWT token
      const token = this.signToken(userId);

      logger.info(`User authenticated via Google: ${email}`);

      return { user: user as IUser, token };
    } catch (error) {
      logger.error("Google authentication error", error);
      throw new AppError("Failed to authenticate with Google", 400);
    }
  },
};
