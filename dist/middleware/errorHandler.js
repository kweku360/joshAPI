"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const appError_1 = require("../utils/appError");
const helpers_1 = require("../utils/helpers");
const config_1 = __importDefault(require("../config"));
const errorHandler = (err, req, res, next) => {
    // Default error status and message
    let statusCode = 500;
    let message = "Something went wrong";
    let errorDetails = {};
    // Redact sensitive information from request
    const redactedReq = {
        method: req.method,
        path: req.path,
        query: (0, helpers_1.redactSensitiveInfo)(req.query),
        body: (0, helpers_1.redactSensitiveInfo)(req.body || {}),
        headers: (0, helpers_1.redactSensitiveInfo)(req.headers, [
            "authorization",
            "cookie",
            "x-api-key",
        ]),
    };
    // Log the error with context
    logger_1.logger.error(`${err.name}: ${err.message}`, {
        stack: err.stack,
        request: redactedReq,
    });
    // Handle known error types
    if (err instanceof appError_1.AppError) {
        statusCode = err.statusCode;
        message = err.message;
        errorDetails = err.details || {};
    }
    else if (err.name === "ValidationError") {
        statusCode = 400;
        message = "Validation Error";
        errorDetails = { details: err.message };
    }
    else if (err.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "Invalid token. Please log in again.";
    }
    else if (err.name === "TokenExpiredError") {
        statusCode = 401;
        message = "Your token has expired. Please log in again.";
    }
    else if (err.name === "PrismaClientKnownRequestError") {
        statusCode = 400;
        message = "Database operation failed";
        // @ts-ignore
        if (err.code === "P2002") {
            message = "A record with this data already exists";
        }
    }
    // Send response
    res.status(statusCode).json(Object.assign(Object.assign({ status: "error", message }, (config_1.default.env === "development" ? { stack: err.stack } : {})), (Object.keys(errorDetails).length > 0 ? { details: errorDetails } : {})));
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map