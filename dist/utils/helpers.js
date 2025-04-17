"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRandomPassword = generateRandomPassword;
exports.redactSensitiveInfo = redactSensitiveInfo;
exports.convertObjectWithNumericKeysToArrays = convertObjectWithNumericKeysToArrays;
exports.fixArrayStructure = fixArrayStructure;
/**
 * Generates a random password with specified length
 * @param length Length of the password
 * @returns Random password
 */
function generateRandomPassword(length = 10) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let password = "";
    // Ensure at least one character from each category
    password += getRandomChar("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    password += getRandomChar("abcdefghijklmnopqrstuvwxyz");
    password += getRandomChar("0123456789");
    password += getRandomChar("!@#$%^&*()_+");
    // Fill the rest of the password
    for (let i = password.length; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    // Shuffle the password
    return password
        .split("")
        .sort(() => 0.5 - Math.random())
        .join("");
}
/**
 * Gets a random character from the provided charset
 * @param charset String of characters to choose from
 * @returns A single random character
 */
function getRandomChar(charset) {
    return charset.charAt(Math.floor(Math.random() * charset.length));
}
/**
 * Redacts sensitive information from objects for logging
 * @param obj Object to redact
 * @param keysToRedact Array of keys to redact
 * @returns Redacted object
 */
function redactSensitiveInfo(obj, keysToRedact = ["password", "token", "secret", "creditCard"]) {
    const redacted = Object.assign({}, obj);
    for (const key in redacted) {
        if (keysToRedact.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
            redacted[key] = "[REDACTED]";
        }
        else if (typeof redacted[key] === "object" && redacted[key] !== null) {
            redacted[key] = redactSensitiveInfo(redacted[key], keysToRedact);
        }
    }
    return redacted;
}
/**
 * Recursively converts objects with numeric keys to arrays
 * For example: {"0": {a: 1}, "1": {b: 2}} becomes [{a: 1}, {b: 2}]
 */
function convertObjectWithNumericKeysToArrays(obj) {
    // Not an object or null, return as is
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    // Handle arrays - process each element
    if (Array.isArray(obj)) {
        return obj.map((item) => convertObjectWithNumericKeysToArrays(item));
    }
    // Check if this is an object with consecutive numeric keys starting from 0
    const keys = Object.keys(obj);
    const isNumericArray = keys.length > 0 && keys.every((key, index) => String(index) === key);
    if (isNumericArray) {
        // Convert to proper array
        return keys.map((key) => convertObjectWithNumericKeysToArrays(obj[key]));
    }
    // Regular object - process each property
    const result = {};
    for (const key in obj) {
        result[key] = convertObjectWithNumericKeysToArrays(obj[key]);
    }
    return result;
}
/**
 * Logs and fixes array structure issues in request data
 * @param obj Any object that might have numeric keys that should be arrays
 * @param context Description of where the data is coming from (for logging)
 */
function fixArrayStructure(obj, context = "unknown") {
    // If null or primitive, return as is
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    // If it's an array already, process each element
    if (Array.isArray(obj)) {
        return obj.map((item) => fixArrayStructure(item, context));
    }
    // Check if object has numeric keys (0, 1, 2...)
    const keys = Object.keys(obj);
    const hasNumericKeysOnly = keys.length > 0 &&
        keys.every((key) => !isNaN(parseInt(key)) && parseInt(key).toString() === key);
    // If object has only numeric keys, convert to array
    if (hasNumericKeysOnly) {
        const result = [];
        const sortedKeys = keys.sort((a, b) => parseInt(a) - parseInt(b));
        for (const key of sortedKeys) {
            result.push(fixArrayStructure(obj[key], `${context}-${key}`));
        }
        return result;
    }
    // Regular object - process each property
    const result = {};
    for (const key of keys) {
        result[key] = fixArrayStructure(obj[key], `${context}-${key}`);
    }
    return result;
}
//# sourceMappingURL=helpers.js.map