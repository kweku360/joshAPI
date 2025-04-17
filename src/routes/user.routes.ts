import express from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { userController } from "../controllers/user.controller";
import { csrfProtection } from "../utils/security";

const router = express.Router();

// All user routes need authentication
router.use(authMiddleware.protect);

// User profile routes
router.get("/profile", userController.getProfile);
router.get("/profile/dashboard", userController.getProfileWithBookings);
router.patch("/profile", userController.updateProfile);

// User bookings routes
router.get("/bookings", userController.getUserBookings);

// Delete account - protected with CSRF
router.delete("/account", csrfProtection, userController.deleteAccount);

export default router;
