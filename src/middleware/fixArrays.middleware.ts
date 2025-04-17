import { Request, Response, NextFunction } from "express";
import { fixArrayStructure } from "../utils/helpers";
import { logger } from "../utils/logger";

/**
 * Middleware to fix objects with numeric keys that should be arrays in request body
 * This is particularly important for the flight booking and pricing endpoints
 */
export const fixArrayStructureMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.body && typeof req.body === "object") {
      // Fix array structures in the request body
      req.body = fixArrayStructure(req.body, `${req.method} ${req.path}`);
    }
    next();
  } catch (error) {
    logger.error("Error in fixArrayStructureMiddleware", error);
    next(); // Continue even if there's an error
  }
};
