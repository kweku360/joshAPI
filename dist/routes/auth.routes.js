"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// OTP routes with rate limiting
router.post("/register-otp", authMiddleware_1.authMiddleware.authLimiter, auth_controller_1.authController.registerOTP);
router.post("/verify-otp", authMiddleware_1.authMiddleware.authLimiter, auth_controller_1.authController.verifyOTP);
router.post("/login-otp", authMiddleware_1.authMiddleware.authLimiter, auth_controller_1.authController.loginOTP);
router.post("/verify-login-otp", authMiddleware_1.authMiddleware.authLimiter, auth_controller_1.authController.verifyLoginOTP);
// Google OAuth route
router.post("/google", auth_controller_1.authController.googleAuth);
// Guest account routes
router.post("/guest", auth_controller_1.authController.createGuestAccount);
router.post("/verify-guest", auth_controller_1.authController.verifyGuestOTP);
router.post("/upgrade-guest", auth_controller_1.authController.upgradeGuestAccount);
// Logout
router.post("/logout", auth_controller_1.authController.logout);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map