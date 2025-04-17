"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catchAsync = void 0;
/**
 * Wraps an async express route handler to automatically catch errors
 * and pass them to the next middleware (error handler)
 *
 * @param fn The async route handler function to wrap
 * @returns A function that catches any errors and passes them to next()
 */
const catchAsync = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};
exports.catchAsync = catchAsync;
//# sourceMappingURL=catchAsync.js.map