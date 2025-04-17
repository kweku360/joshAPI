"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.flightTimeoutHandler = exports.timeoutHandler = void 0;
const express_timeout_handler_1 = __importDefault(require("express-timeout-handler"));
const logger_1 = require("../utils/logger");
// Create timeout middleware with options
exports.timeoutHandler = express_timeout_handler_1.default.set({
    // Default timeout in milliseconds (15 seconds)
    timeout: 15000,
    // Function to run on timeout
    onTimeout: (req, res) => {
        const path = req.path;
        logger_1.logger.error(`Request timeout: ${path}`);
        res.status(503).json({
            status: "error",
            message: "Request timed out. The server is experiencing high load or the operation is taking longer than expected.",
            code: "ETIMEDOUT",
        });
    },
    // Custom callback function to handle errors
    onDelayedResponse: (req, res, next, error) => {
        logger_1.logger.error(`Delayed response error: ${(error === null || error === void 0 ? void 0 : error.name) || "unknown"}`, error);
        // Don't bother continuing with the request
        if (res.headersSent)
            return;
        const path = req.path;
        logger_1.logger.warn(`Delayed response: ${path}`);
    },
});
// Flight-specific timeout (30 seconds for flight searches)
exports.flightTimeoutHandler = express_timeout_handler_1.default.set({
    // Longer timeout for flight search API calls
    timeout: 30000,
    // Function to run on timeout
    onTimeout: (req, res) => {
        const path = req.path;
        logger_1.logger.error(`Flight API request timeout: ${path}`);
        res.status(503).json({
            status: "error",
            message: "The flight search request timed out. Please try again or refine your search criteria.",
            code: "ETIMEDOUT",
        });
    },
    // Custom callback function to handle errors
    onDelayedResponse: (req, res, next, error) => {
        logger_1.logger.error(`Flight API delayed response: ${(error === null || error === void 0 ? void 0 : error.name) || "unknown"}`, error);
        // Don't bother continuing with the request
        if (res.headersSent)
            return;
        const path = req.path;
        logger_1.logger.warn(`Flight API delayed response: ${path}`);
    },
});
//# sourceMappingURL=timeout.js.map