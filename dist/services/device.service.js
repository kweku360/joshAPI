"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceService = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const email_service_1 = require("./email.service");
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient();
exports.deviceService = {
    /**
     * Generate a device fingerprint from request data
     * @param req Express request
     * @returns Device fingerprint hash
     */
    generateFingerprint(req) {
        // Combine various user agent data to create a fingerprint
        const data = [
            req.headers["user-agent"] || "",
            req.headers["accept-language"] || "",
            req.ip || "",
        ].join("|");
        // Create a hash of the data for the fingerprint
        return crypto_1.default.createHash("sha256").update(data).digest("hex");
    },
    /**
     * Check if a device is known for a user and notify if it's new
     * @param userId User ID
     * @param deviceFingerprint Device fingerprint
     * @param userEmail User's email for notifications
     * @param userName User's name for notifications
     * @param req Express request
     * @returns Whether the device is known
     */
    checkAndTrackDevice(userId, deviceFingerprint, userEmail, userName, req) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if device exists for this user
                const existingDevice = yield prisma.userDevice.findMany({
                    where: {
                        userId: userId,
                        fingerprint: deviceFingerprint,
                    },
                });
                const isKnownDevice = existingDevice.length > 0;
                if (!isKnownDevice) {
                    // New device - track it
                    yield prisma.userDevice.create({
                        data: {
                            userId: userId,
                            fingerprint: deviceFingerprint,
                            userAgent: req.headers["user-agent"] || "Unknown",
                            ip: req.ip || "0.0.0.0",
                            lastUsedAt: new Date(),
                        },
                    });
                    // Send notification about new device login
                    yield this.notifyNewDeviceLogin(userEmail, userName, req);
                    logger_1.logger.info(`New device login for user: ${userId}`);
                    return false;
                }
                else {
                    // Update last used timestamp
                    yield prisma.userDevice.updateMany({
                        where: {
                            userId: userId,
                            fingerprint: deviceFingerprint,
                        },
                        data: {
                            lastUsedAt: new Date(),
                        },
                    });
                    return true;
                }
            }
            catch (error) {
                // Log but don't block authentication on device tracking errors
                logger_1.logger.error("Error tracking device", error);
                return true;
            }
        });
    },
    /**
     * Send a notification about a new device login
     * @param userEmail User's email
     * @param userName User's name
     * @param req Express request
     */
    notifyNewDeviceLogin(userEmail, userName, req) {
        return __awaiter(this, void 0, void 0, function* () {
            const userAgent = req.headers["user-agent"] || "Unknown device";
            const ip = req.ip || "Unknown IP";
            const time = new Date().toLocaleString();
            const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Device Login</h2>
        <p>Hello ${userName || "there"},</p>
        <p>We detected a login to your Josh Travels account from a new device:</p>
        <div style="margin: 20px 0; padding: 15px; background-color: #f7f7f7; border-radius: 5px;">
          <p><strong>Time:</strong> ${time}</p>
          <p><strong>Device:</strong> ${userAgent}</p>
          <p><strong>IP Address:</strong> ${ip}</p>
        </div>
        <p>If this was you, no action is needed.</p>
        <p>If you didn't sign in from a new device, please contact our support team immediately to secure your account.</p>
        <p>Best regards,<br>The Josh Travels Team</p>
      </div>
    `;
            const text = `
      New Device Login
      
      Hello ${userName || "there"},
      
      We detected a login to your Josh Travels account from a new device:
      
      Time: ${time}
      Device: ${userAgent}
      IP Address: ${ip}
      
      If this was you, no action is needed.
      
      If you didn't sign in from a new device, please contact our support team immediately to secure your account.
      
      Best regards,
      The Josh Travels Team
    `;
            yield email_service_1.emailService.sendEmail(userEmail, "New Device Login - Josh Travels", html, text);
        });
    },
};
//# sourceMappingURL=device.service.js.map