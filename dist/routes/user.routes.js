"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const user_controller_1 = require("../controllers/user.controller");
const security_1 = require("../utils/security");
const router = express_1.default.Router();
// All user routes need authentication
router.use(authMiddleware_1.authMiddleware.protect);
// User profile routes
router.get("/profile", user_controller_1.userController.getProfile);
router.get("/profile/dashboard", user_controller_1.userController.getProfileWithBookings);
router.patch("/profile", user_controller_1.userController.updateProfile);
// User bookings routes
router.get("/bookings", user_controller_1.userController.getUserBookings);
// Delete account - protected with CSRF
router.delete("/account", security_1.csrfProtection, user_controller_1.userController.deleteAccount);
exports.default = router;
//# sourceMappingURL=user.routes.js.map