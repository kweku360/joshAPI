import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { AppError } from "../utils/appError";
import { redactSensitiveInfo } from "../utils/helpers";
import config from "../config";

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default error status and message
  let statusCode = 500;
  let message = "Something went wrong";
  let errorDetails = {};

  // Redact sensitive information from request
  const redactedReq = {
    method: req.method,
    path: req.path,
    query: redactSensitiveInfo(req.query as Record<string, any>),
    body: redactSensitiveInfo(req.body || {}),
    headers: redactSensitiveInfo(req.headers as Record<string, any>, [
      "authorization",
      "cookie",
      "x-api-key",
    ]),
  };

  // Log the error with context
  logger.error(`${err.name}: ${err.message}`, {
    stack: err.stack,
    request: redactedReq,
  });

  // Handle known error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorDetails = err.details || {};
  } else if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
    errorDetails = { details: err.message };
  } else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token. Please log in again.";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Your token has expired. Please log in again.";
  } else if (err.name === "PrismaClientKnownRequestError") {
    statusCode = 400;
    message = "Database operation failed";
    // @ts-ignore
    if (err.code === "P2002") {
      message = "A record with this data already exists";
    }
  }

  // Send response
  res.status(statusCode).json({
    status: "error",
    message,
    ...(config.env === "development" ? { stack: err.stack } : {}),
    ...(Object.keys(errorDetails).length > 0 ? { details: errorDetails } : {}),
  });
};
