"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const booking_controller_1 = require("../controllers/booking.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const security_1 = require("../utils/security");
const router = express_1.default.Router();
// Protect all booking routes
router.use(authMiddleware_1.authMiddleware.protect);
// Apply CSRF protection to mutating operations
router.post("/", security_1.csrfProtection, booking_controller_1.bookingController.createBooking);
router.patch("/:id/cancel", security_1.csrfProtection, booking_controller_1.bookingController.cancelBooking);
// Read operations
router.get("/", booking_controller_1.bookingController.getUserBookings);
router.get("/:id", booking_controller_1.bookingController.getBooking);
router.get("/reference/:reference", booking_controller_1.bookingController.getBookingByReference);
router.get("/:id/e-ticket", booking_controller_1.bookingController.generateETicket);
// Admin-only routes
router.post("/:id/confirm", security_1.csrfProtection, authMiddleware_1.authMiddleware.restrictTo("ADMIN"), booking_controller_1.bookingController.confirmBookingWithAmadeus);
// Flight booking routes
router.post("/flights", booking_controller_1.bookingController.createFlightBooking);
router.get("/flights", booking_controller_1.bookingController.getUserFlightBookings);
router.get("/flights/:id", booking_controller_1.bookingController.getFlightBookingDetails);
exports.default = router;
//# sourceMappingURL=booking.routes.js.map