"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixArrayStructureMiddleware = void 0;
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
/**
 * Middleware to fix objects with numeric keys that should be arrays in request body
 * This is particularly important for the flight booking and pricing endpoints
 */
const fixArrayStructureMiddleware = (req, res, next) => {
    try {
        if (req.body && typeof req.body === "object") {
            // Fix array structures in the request body
            req.body = (0, helpers_1.fixArrayStructure)(req.body, `${req.method} ${req.path}`);
        }
        next();
    }
    catch (error) {
        logger_1.logger.error("Error in fixArrayStructureMiddleware", error);
        next(); // Continue even if there's an error
    }
};
exports.fixArrayStructureMiddleware = fixArrayStructureMiddleware;
//# sourceMappingURL=fixArrays.middleware.js.map