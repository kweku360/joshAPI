/**
 * Generates a random password with specified length
 * @param length Length of the password
 * @returns Random password
 */
export declare function generateRandomPassword(length?: number): string;
/**
 * Redacts sensitive information from objects for logging
 * @param obj Object to redact
 * @param keysToRedact Array of keys to redact
 * @returns Redacted object
 */
export declare function redactSensitiveInfo(obj: Record<string, any>, keysToRedact?: string[]): Record<string, any>;
/**
 * Recursively converts objects with numeric keys to arrays
 * For example: {"0": {a: 1}, "1": {b: 2}} becomes [{a: 1}, {b: 2}]
 */
export declare function convertObjectWithNumericKeysToArrays(obj: any): any;
/**
 * Logs and fixes array structure issues in request data
 * @param obj Any object that might have numeric keys that should be arrays
 * @param context Description of where the data is coming from (for logging)
 */
export declare function fixArrayStructure(obj: any, context?: string): any;
//# sourceMappingURL=helpers.d.ts.map