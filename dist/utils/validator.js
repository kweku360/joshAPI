"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = validateRequest;
const zod_1 = require("zod");
const appError_1 = require("./appError");
function validateRequest(data, schema) {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const formattedErrors = error.errors.map((err) => ({
                path: err.path.join("."),
                message: err.message,
            }));
            throw new appError_1.AppError("Validation error", 400, { errors: formattedErrors });
        }
        throw error;
    }
}
//# sourceMappingURL=validator.js.map