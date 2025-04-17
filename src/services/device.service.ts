import { PrismaClient } from "@prisma/client";
import { Request } from "express";
import crypto from "crypto";
import { emailService } from "./email.service";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();

export const deviceService = {
  /**
   * Generate a device fingerprint from request data
   * @param req Express request
   * @returns Device fingerprint hash
   */
  generateFingerprint(req: Request): string {
    // Combine various user agent data to create a fingerprint
    const data = [
      req.headers["user-agent"] || "",
      req.headers["accept-language"] || "",
      req.ip || "",
    ].join("|");

    // Create a hash of the data for the fingerprint
    return crypto.createHash("sha256").update(data).digest("hex");
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
  async checkAndTrackDevice(
    userId: string,
    deviceFingerprint: string,
    userEmail: string,
    userName: string,
    req: Request
  ): Promise<boolean> {
    try {
      // Check if device exists for this user
      const existingDevice = await prisma.userDevice.findMany({
        where: {
          userId: userId,
          fingerprint: deviceFingerprint,
        },
      });

      const isKnownDevice = existingDevice.length > 0;

      if (!isKnownDevice) {
        // New device - track it
        await prisma.userDevice.create({
          data: {
            userId: userId,
            fingerprint: deviceFingerprint,
            userAgent: (req.headers["user-agent"] as string) || "Unknown",
            ip: req.ip || "0.0.0.0",
            lastUsedAt: new Date(),
          },
        });

        // Send notification about new device login
        await this.notifyNewDeviceLogin(userEmail, userName, req);

        logger.info(`New device login for user: ${userId}`);
        return false;
      } else {
        // Update last used timestamp
        await prisma.userDevice.updateMany({
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
    } catch (error) {
      // Log but don't block authentication on device tracking errors
      logger.error("Error tracking device", error);
      return true;
    }
  },

  /**
   * Send a notification about a new device login
   * @param userEmail User's email
   * @param userName User's name
   * @param req Express request
   */
  async notifyNewDeviceLogin(
    userEmail: string,
    userName: string,
    req: Request
  ): Promise<void> {
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

    await emailService.sendEmail(
      userEmail,
      "New Device Login - Josh Travels",
      html,
      text
    );
  },
};
