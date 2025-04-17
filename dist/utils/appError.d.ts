export declare class AppError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;
    details?: Record<string, any>;
    constructor(message: string, statusCode: number, details?: Record<string, any>);
}
//# sourceMappingURL=appError.d.ts.map