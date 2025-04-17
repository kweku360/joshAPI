import express from "express";
import { bookingController } from "../controllers/booking.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { csrfProtection } from "../utils/security";

const router = express.Router();

// Protect all booking routes
router.use(authMiddleware.protect);

// Apply CSRF protection to mutating operations
router.post("/", csrfProtection, bookingController.createBooking);
router.patch("/:id/cancel", csrfProtection, bookingController.cancelBooking);

// Read operations
router.get("/", bookingController.getUserBookings);
router.get("/:id", bookingController.getBooking);
router.get("/reference/:reference", bookingController.getBookingByReference);
router.get("/:id/e-ticket", bookingController.generateETicket);

// Admin-only routes
router.post(
  "/:id/confirm",
  csrfProtection,
  authMiddleware.restrictTo("ADMIN"),
  bookingController.confirmBookingWithAmadeus
);

// Flight booking routes
router.post("/flights", bookingController.createFlightBooking);
router.get("/flights", bookingController.getUserFlightBookings);
router.get("/flights/:id", bookingController.getFlightBookingDetails);

export default router;
