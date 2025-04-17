import express from "express";
import { authController } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

// OTP routes with rate limiting
router.post(
  "/register-otp",
  authMiddleware.authLimiter,
  authController.registerOTP
);
router.post(
  "/verify-otp",
  authMiddleware.authLimiter,
  authController.verifyOTP
);
router.post("/login-otp", authMiddleware.authLimiter, authController.loginOTP);
router.post(
  "/verify-login-otp",
  authMiddleware.authLimiter,
  authController.verifyLoginOTP
);

// Google OAuth route
router.post("/google", authController.googleAuth);

// Guest account routes
router.post("/guest", authController.createGuestAccount);
router.post("/verify-guest", authController.verifyGuestOTP);
router.post("/upgrade-guest", authController.upgradeGuestAccount);

// Logout
router.post("/logout", authController.logout);

export default router;
