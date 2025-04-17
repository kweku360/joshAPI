import { Request } from "express";
export declare const deviceService: {
    /**
     * Generate a device fingerprint from request data
     * @param req Express request
     * @returns Device fingerprint hash
     */
    generateFingerprint(req: Request): string;
    /**
     * Check if a device is known for a user and notify if it's new
     * @param userId User ID
     * @param deviceFingerprint Device fingerprint
     * @param userEmail User's email for notifications
     * @param userName User's name for notifications
     * @param req Express request
     * @returns Whether the device is known
     */
    checkAndTrackDevice(userId: string, deviceFingerprint: string, userEmail: string, userName: string, req: Request): Promise<boolean>;
    /**
     * Send a notification about a new device login
     * @param userEmail User's email
     * @param userName User's name
     * @param req Express request
     */
    notifyNewDeviceLogin(userEmail: string, userName: string, req: Request): Promise<void>;
};
//# sourceMappingURL=device.service.d.ts.map