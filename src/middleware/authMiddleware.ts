import { Request, Response, NextFunction } from "express";
import { PrismaClient, User } from "@prisma/client";
import jwt from "jsonwebtoken";
import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import { AppError } from "../utils/appError";
import config from "../config";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();

interface JwtPayload {
  id: string;
  iat: number;
}

// Rate limiting for auth endpoints
const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes",
  skipSuccessfulRequests: true, // only count failed requests
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit headers
});

/**
 * Required authentication middleware
 * Will fail if no valid token is provided
 */
const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token;

    // Get token from Authorization header or cookie
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(
        new AppError("You are not logged in. Please log in to get access.", 401)
      );
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    if (!decoded || !decoded.id) {
      return next(new AppError("Invalid token format", 401));
    }

    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return next(
        new AppError("The user belonging to this token no longer exists.", 401)
      );
    }

    // Check if user is active
    if (user.status === "INACTIVE") {
      return next(new AppError("This account has been deactivated.", 401));
    }

    // Check if user changed password after the token was issued
    if (user.passwordResetAt) {
      const changedTimestamp = user.passwordResetAt.getTime() / 1000;

      if (decoded.iat < changedTimestamp) {
        return next(
          new AppError(
            "User recently changed password. Please log in again.",
            401
          )
        );
      }
    }

    // Grant access to protected route
    req.user = user;
    next();
  } catch (error) {
    logger.error("Authentication error", error);
    next(new AppError("Invalid token. Please log in again.", 401));
  }
};

/**
 * Optional authentication middleware
 * If a token is present, it will authenticate the user but won't fail if no token is provided
 */
const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let token;

    // Get token from Authorization header or cookie
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    // If no token, just continue as guest
    if (!token) {
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    if (!decoded || !decoded.id) {
      // Invalid token but we don't want to fail
      return next();
    }

    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      // User doesn't exist but we don't want to fail
      return next();
    }

    // Check if user is active
    if (user.status === "INACTIVE") {
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
  } catch (error) {
    // Any error, just continue as guest
    logger.debug("Optional auth error", error);
    next();
  }
};

/**
 * Role-based authorization middleware
 * Restricts access to certain roles
 */
const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("You are not logged in", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }
    next();
  };
};

export const authMiddleware = {
  authLimiter,
  protect,
  optionalAuth,
  restrictTo,
};
