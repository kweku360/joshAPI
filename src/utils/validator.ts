import { z } from "zod";
import { AppError } from "./appError";

export function validateRequest<T>(data: any, schema: z.ZodType<T>): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map((err) => ({
        path: err.path.join("."),
        message: err.message,
      }));

      throw new AppError("Validation error", 400, { errors: formattedErrors });
    }
    throw error;
  }
}
