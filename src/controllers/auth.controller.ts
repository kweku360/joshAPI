import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { deviceService } from "../services/device.service";
import { AppError } from "../utils/appError";
import { validateRequest } from "../utils/validator";
import { z } from "zod";
import config from "../config";
import { redisService } from "../services/redis.service";
import { logger } from "../utils/logger";

export const authController = {
  /**
   * Send OTP for registration
   */
  async registerOTP(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const schema = z.object({
        email: z.string().email("Invalid email address"),
      });

      const validatedData = validateRequest(req.body, schema);

      // Request OTP for registration
      const expiresAt = await authService.registerWithOTP(validatedData.email);

      // Return response
      res.status(200).json({
        status: "success",
        message: "OTP sent to your email for verification",
        data: {
          expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verify OTP and complete registration
   */
  async verifyOTP(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const schema = z.object({
        email: z.string().email("Invalid email address"),
        otp: z.string().length(6, "OTP must be 6 digits"),
        firstName: z
          .string()
          .min(2, "First name must be at least 2 characters"),
        lastName: z.string().min(2, "Last name must be at least 2 characters"),
        phone: z.string().optional(),
      });

      const validatedData = validateRequest(req.body, schema);

      // Test Redis connection
      const redisConnected = await redisService.testConnection();
      if (!redisConnected) {
        return res.status(503).json({
          status: "error",
          message: "Service temporarily unavailable. Please try again later.",
          retryAfter: 30, // Suggest retry after 30 seconds
        });
      }

      // Verify OTP and register/login user
      const { user, token } = await authService.verifyOTPAndRegister(
        validatedData.email,
        validatedData.otp,
        validatedData.firstName,
        validatedData.lastName,
        validatedData.phone
      );

      // Track device
      const deviceFingerprint = deviceService.generateFingerprint(req);
      await deviceService.checkAndTrackDevice(
        user.id,
        deviceFingerprint,
        user.email,
        user.name || `${validatedData.firstName} ${validatedData.lastName}`,
        req
      );

      // Set cookie
      const cookieOptions = {
        expires: new Date(
          Date.now() + config.jwtCookieExpiresIn * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        secure: req.secure || req.headers["x-forwarded-proto"] === "https",
        sameSite: "strict" as const,
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
    } catch (error) {
      // Handle specific OTP errors with friendly messages
      if (error instanceof AppError) {
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
  },

  /**
   * Send OTP for login
   */
  async loginOTP(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const schema = z.object({
        email: z.string().email("Invalid email address"),
      });

      const validatedData = validateRequest(req.body, schema);

      // Request OTP for login
      const expiresAt = await authService.loginWithOTP(validatedData.email);

      // Return response
      res.status(200).json({
        status: "success",
        message: "OTP sent to your email for login",
        data: {
          expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verify login OTP
   */
  async verifyLoginOTP(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const schema = z.object({
        email: z.string().email("Invalid email address"),
        otp: z.string().length(6, "OTP must be 6 digits"),
      });

      const validatedData = validateRequest(req.body, schema);

      // Test Redis connection
      const redisConnected = await redisService.testConnection();
      if (!redisConnected) {
        return res.status(503).json({
          status: "error",
          message: "Service temporarily unavailable. Please try again later.",
          retryAfter: 30, // Suggest retry after 30 seconds
        });
      }

      // Verify OTP and login user
      const { user, token } = await authService.verifyOTPAndLogin(
        validatedData.email,
        validatedData.otp
      );

      // Track device
      const deviceFingerprint = deviceService.generateFingerprint(req);
      await deviceService.checkAndTrackDevice(
        user.id,
        deviceFingerprint,
        user.email,
        user.name || "",
        req
      );

      // Set cookie
      const cookieOptions = {
        expires: new Date(
          Date.now() + config.jwtCookieExpiresIn * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        secure: req.secure || req.headers["x-forwarded-proto"] === "https",
        sameSite: "strict" as const,
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
    } catch (error) {
      // Handle specific OTP errors with friendly messages
      if (error instanceof AppError) {
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
  },

  /**
   * Authenticate with Google
   */
  async googleAuth(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const schema = z.object({
        idToken: z.string(),
      });

      const validatedData = validateRequest(req.body, schema);

      // Authenticate with Google
      const { user, token } = await authService.googleAuth(
        validatedData.idToken
      );

      // Track device
      const deviceFingerprint = deviceService.generateFingerprint(req);
      await deviceService.checkAndTrackDevice(
        user.id,
        deviceFingerprint,
        user.email,
        user.name || "",
        req
      );

      // Set cookie
      const cookieOptions = {
        expires: new Date(
          Date.now() + config.jwtCookieExpiresIn * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        secure: req.secure || req.headers["x-forwarded-proto"] === "https",
        sameSite: "strict" as const,
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
    } catch (error) {
      next(error);
    }
  },

  async logout(req: Request, res: Response) {
    res.cookie("jwt", "loggedout", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
      secure: req.secure || req.headers["x-forwarded-proto"] === "https",
      sameSite: "strict" as const,
    });

    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  },

  /**
   * Create guest account with OTP
   * @route POST /auth/guest
   * @access Public
   */
  async createGuestAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      if (!email) {
        throw new AppError("Email is required", 400);
      }

      const expiresAt = await authService.createGuestAccount(email);

      res.status(200).json({
        status: "success",
        message: "OTP sent to email for guest account creation",
        data: { expiresAt },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verify OTP and create guest account
   * @route POST /auth/verify-guest
   * @access Public
   */
  async verifyGuestOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        throw new AppError("Email and OTP are required", 400);
      }

      // Log the received inputs for debugging
      logger.debug(`Verifying guest OTP for ${email} with code: ${otp}`);

      // Check Redis connection status for debugging
      const redisConnected = await redisService.isConnected();
      logger.debug(
        `Redis connection status: ${redisConnected ? "Connected" : "Disconnected"}`
      );

      // Attempt Redis lookup for debugging
      const redisKey = `guest_otp_${email}`;
      const redisOTP = await redisService.get<string>(redisKey);
      logger.debug(
        `Redis OTP for ${redisKey}: ${redisOTP ? "Exists" : "Not found"}`
      );

      const user = await authService.verifyGuestOTP(email, otp);

      res.status(200).json({
        status: "success",
        message: "Guest account created successfully",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Upgrade guest account to full user account
   * @route POST /auth/upgrade-guest
   * @access Public
   */
  async upgradeGuestAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, firstName, lastName, phone } = req.body;

      if (!email || !firstName || !lastName) {
        throw new AppError(
          "Email, first name, and last name are required",
          400
        );
      }

      const { user, token } = await authService.upgradeGuestUser(
        email,
        firstName,
        lastName,
        phone
      );

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
    } catch (error) {
      next(error);
    }
  },
};
