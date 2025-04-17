import timeout from "express-timeout-handler";
import { logger } from "../utils/logger";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError";

// Create timeout middleware with options
export const timeoutHandler = timeout.set({
  // Default timeout in milliseconds (15 seconds)
  timeout: 15000,

  // Function to run on timeout
  onTimeout: (req: Request, res: Response) => {
    const path = req.path;
    logger.error(`Request timeout: ${path}`);
    res.status(503).json({
      status: "error",
      message:
        "Request timed out. The server is experiencing high load or the operation is taking longer than expected.",
      code: "ETIMEDOUT",
    });
  },

  // Custom callback function to handle errors
  onDelayedResponse: (
    req: Request,
    res: Response,
    next: NextFunction,
    error: Error
  ) => {
    logger.error(`Delayed response error: ${error?.name || "unknown"}`, error);

    // Don't bother continuing with the request
    if (res.headersSent) return;

    const path = req.path;
    logger.warn(`Delayed response: ${path}`);
  },
});

// Flight-specific timeout (30 seconds for flight searches)
export const flightTimeoutHandler = timeout.set({
  // Longer timeout for flight search API calls
  timeout: 30000,

  // Function to run on timeout
  onTimeout: (req: Request, res: Response) => {
    const path = req.path;
    logger.error(`Flight API request timeout: ${path}`);
    res.status(503).json({
      status: "error",
      message:
        "The flight search request timed out. Please try again or refine your search criteria.",
      code: "ETIMEDOUT",
    });
  },

  // Custom callback function to handle errors
  onDelayedResponse: (
    req: Request,
    res: Response,
    next: NextFunction,
    error: Error
  ) => {
    logger.error(
      `Flight API delayed response: ${error?.name || "unknown"}`,
      error
    );

    // Don't bother continuing with the request
    if (res.headersSent) return;

    const path = req.path;
    logger.warn(`Flight API delayed response: ${path}`);
  },
});
