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
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingController = void 0;
const booking_service_1 = require("../services/booking.service");
const appError_1 = require("../utils/appError");
const validator_1 = require("../utils/validator");
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const security_1 = require("../utils/security");
const perf_hooks_1 = require("perf_hooks");
// Schema definitions - placed outside functions for better reuse and performance
const createBookingSchema = zod_1.z.object({
    flightOfferId: zod_1.z.string().min(1, "Flight offer ID is required"),
    flightOfferData: zod_1.z.custom(),
    passengerDetails: zod_1.z
        .array(zod_1.z.object({
        id: zod_1.z.string().min(1, "Passenger ID is required"),
        firstName: zod_1.z
            .string()
            .min(2, "First name must be at least 2 characters"),
        lastName: zod_1.z.string().min(2, "Last name must be at least 2 characters"),
        dateOfBirth: zod_1.z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
        gender: zod_1.z.enum(["MALE", "FEMALE", "UNSPECIFIED"]).optional(),
        email: zod_1.z.string().email("Invalid email address").optional(),
        phone: zod_1.z.string().optional(),
        documentType: zod_1.z.enum(["PASSPORT", "ID_CARD", "VISA"]).optional(),
        documentNumber: zod_1.z.string().optional(),
        documentIssuingCountry: zod_1.z
            .string()
            .length(2, "Country code must be 2 characters")
            .optional(),
        documentExpiryDate: zod_1.z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be in YYYY-MM-DD format")
            .optional(),
    }))
        .min(1, "At least one passenger is required"),
    totalAmount: zod_1.z.number().positive("Total amount must be positive"),
    currency: zod_1.z
        .string()
        .length(3, "Currency code must be 3 characters")
        .optional(),
});
const bookingIdSchema = zod_1.z.object({
    id: zod_1.z.string().uuid("Invalid booking ID format"),
});
const bookingReferenceSchema = zod_1.z.object({
    reference: zod_1.z
        .string()
        .min(8, "Booking reference must be at least 8 characters"),
});
exports.bookingController = {
    /**
     * Create a new booking
     */
    createBooking(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const startTime = perf_hooks_1.performance.now();
            try {
                logger_1.logger.info("Booking creation request", {
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                    ip: req.ip,
                });
                // Validate request body
                const validatedData = (0, validator_1.validateRequest)(req.body, createBookingSchema);
                // Sanitize passenger details
                const sanitizedPassengers = validatedData.passengerDetails.map((passenger) => (Object.assign(Object.assign({}, passenger), { firstName: (0, security_1.sanitizeInput)(passenger.firstName), lastName: (0, security_1.sanitizeInput)(passenger.lastName), email: passenger.email ? (0, security_1.sanitizeInput)(passenger.email) : undefined, documentNumber: passenger.documentNumber
                        ? (0, security_1.sanitizeInput)(passenger.documentNumber)
                        : undefined })));
                // Create booking
                const booking = yield booking_service_1.bookingService.createBooking(req.user.id, validatedData.flightOfferId, validatedData.flightOfferData, sanitizedPassengers, validatedData.totalAmount, validatedData.currency);
                // Add performance timing header
                const endTime = perf_hooks_1.performance.now();
                res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);
                // Return response
                return void res.status(201).json({
                    status: "success",
                    data: {
                        booking: {
                            id: booking.id,
                            bookingReference: booking.bookingReference,
                            status: booking.status,
                            totalAmount: booking.totalAmount,
                            currency: booking.currency,
                            createdAt: booking.createdAt,
                        },
                    },
                });
            }
            catch (error) {
                logger_1.logger.error("Booking creation error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                });
                return void next(error);
            }
        });
    },
    /**
     * Get a booking by ID
     */
    getBooking(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const startTime = perf_hooks_1.performance.now();
            try {
                // Validate request params
                const validatedData = (0, validator_1.validateRequest)(req.params, bookingIdSchema);
                // Get booking
                const booking = yield booking_service_1.bookingService.getBookingById(validatedData.id);
                // Check if booking belongs to user
                if (booking.userId !== req.user.id && req.user.role !== "ADMIN") {
                    return void next(new appError_1.AppError("You do not have permission to access this booking", 403));
                }
                // Add performance timing header
                const endTime = perf_hooks_1.performance.now();
                res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);
                // Set ETag for caching
                res.set("ETag", `W/"booking-${booking.id}-${booking.updatedAt.getTime()}"`);
                // Return response
                return void res.status(200).json({
                    status: "success",
                    data: {
                        booking,
                    },
                });
            }
            catch (error) {
                logger_1.logger.error("Get booking error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                    bookingId: req.params.id,
                });
                next(error);
            }
        });
    },
    /**
     * Get a booking by reference number
     */
    getBookingByReference(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const startTime = perf_hooks_1.performance.now();
            try {
                // Validate request params
                const validatedData = (0, validator_1.validateRequest)(req.params, bookingReferenceSchema);
                // Sanitize reference
                const sanitizedReference = (0, security_1.sanitizeInput)(validatedData.reference);
                // Get booking
                const booking = yield booking_service_1.bookingService.getBookingByReference(sanitizedReference);
                // Check if booking belongs to user
                if (booking.userId !== req.user.id && req.user.role !== "ADMIN") {
                    return void next(new appError_1.AppError("You do not have permission to access this booking", 403));
                }
                // Add performance timing header
                const endTime = perf_hooks_1.performance.now();
                res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);
                // Set ETag for caching
                res.set("ETag", `W/"booking-ref-${booking.bookingReference}-${booking.updatedAt.getTime()}"`);
                // Return response
                return void res.status(200).json({
                    status: "success",
                    data: {
                        booking,
                    },
                });
            }
            catch (error) {
                logger_1.logger.error("Get booking by reference error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                    reference: req.params.reference,
                });
                next(error);
            }
        });
    },
    /**
     * Get all bookings for the current user
     */
    getUserBookings(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const startTime = perf_hooks_1.performance.now();
            try {
                // Get user bookings
                const bookings = yield booking_service_1.bookingService.getUserBookings(req.user.id);
                // Add performance timing header
                const endTime = perf_hooks_1.performance.now();
                res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);
                // Return response
                return void res.status(200).json({
                    status: "success",
                    results: bookings.length,
                    data: {
                        bookings,
                    },
                });
            }
            catch (error) {
                logger_1.logger.error("Get user bookings error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                });
                next(error);
            }
        });
    },
    /**
     * Cancel a booking
     */
    cancelBooking(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const startTime = perf_hooks_1.performance.now();
            try {
                // Validate request params
                const validatedData = (0, validator_1.validateRequest)(req.params, bookingIdSchema);
                // Get booking first to check permission
                const booking = yield booking_service_1.bookingService.getBookingById(validatedData.id);
                // Check if booking belongs to user
                if (booking.userId !== req.user.id && req.user.role !== "ADMIN") {
                    return void next(new appError_1.AppError("You do not have permission to cancel this booking", 403));
                }
                // Check if booking is already cancelled or completed
                if (booking.status === "CANCELLED") {
                    return void next(new appError_1.AppError("This booking is already cancelled", 400));
                }
                if (booking.status === "COMPLETED") {
                    return void next(new appError_1.AppError("Completed bookings cannot be cancelled", 400));
                }
                // Cancel booking
                const cancelledBooking = yield booking_service_1.bookingService.cancelBooking(validatedData.id);
                // Add performance timing header
                const endTime = perf_hooks_1.performance.now();
                res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);
                // Return response
                return void res.status(200).json({
                    status: "success",
                    data: {
                        booking: cancelledBooking,
                    },
                });
            }
            catch (error) {
                logger_1.logger.error("Cancel booking error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                    bookingId: req.params.id,
                });
                next(error);
            }
        });
    },
    /**
     * Generate an e-ticket for a confirmed booking
     */
    generateETicket(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const startTime = perf_hooks_1.performance.now();
            try {
                // Validate request params
                const validatedData = (0, validator_1.validateRequest)(req.params, bookingIdSchema);
                // Get booking first to check permission
                const booking = yield booking_service_1.bookingService.getBookingById(validatedData.id);
                // Check if booking belongs to user
                if (booking.userId !== req.user.id && req.user.role !== "ADMIN") {
                    return void next(new appError_1.AppError("You do not have permission to access this booking", 403));
                }
                // Generate e-ticket
                const eTicketUrl = yield booking_service_1.bookingService.generateETicket(validatedData.id);
                // Add performance timing header
                const endTime = perf_hooks_1.performance.now();
                res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);
                // Return response
                return void res.status(200).json({
                    status: "success",
                    data: {
                        eTicketUrl,
                    },
                });
            }
            catch (error) {
                logger_1.logger.error("Generate e-ticket error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                    bookingId: req.params.id,
                });
                next(error);
            }
        });
    },
    /**
     * Confirm a booking with Amadeus (admin or system use)
     */
    confirmBookingWithAmadeus(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const startTime = perf_hooks_1.performance.now();
            try {
                // Validate request params
                const validatedData = (0, validator_1.validateRequest)(req.params, bookingIdSchema);
                // Only admin can use this endpoint
                if (req.user.role !== "ADMIN") {
                    return void next(new appError_1.AppError("You do not have permission to perform this action", 403));
                }
                // Confirm booking with Amadeus
                const confirmedBooking = yield booking_service_1.bookingService.confirmBookingWithAmadeus(validatedData.id);
                // Add performance timing header
                const endTime = perf_hooks_1.performance.now();
                res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);
                // Return response
                return void res.status(200).json({
                    status: "success",
                    data: {
                        booking: confirmedBooking,
                    },
                });
            }
            catch (error) {
                logger_1.logger.error("Confirm booking error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                    bookingId: req.params.id,
                });
                next(error);
            }
        });
    },
    /**
     * Create a flight booking
     * @route POST /api/bookings/flights
     * @access Private
     */
    createFlightBooking(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { flightOffer, travelers, contact } = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    throw new appError_1.AppError("User not authenticated", 401);
                }
                // Validate request body
                if (!flightOffer) {
                    throw new appError_1.AppError("Flight offer is required", 400);
                }
                if (!travelers || !Array.isArray(travelers) || travelers.length === 0) {
                    throw new appError_1.AppError("Traveler information is required", 400);
                }
                if (!contact || !contact.emailAddress || !contact.phones) {
                    throw new appError_1.AppError("Contact information is required", 400);
                }
                // Create booking
                const bookingResult = yield booking_service_1.bookingService.createFlightBooking(userId, flightOffer, travelers, contact);
                return res.status(201).json({
                    status: "success",
                    message: "Flight booking created successfully",
                    data: bookingResult,
                });
            }
            catch (error) {
                logger_1.logger.error("Error creating flight booking", error);
                next(error);
            }
        });
    },
    /**
     * Get user's flight bookings
     * @route GET /api/bookings/flights
     * @access Private
     */
    getUserFlightBookings(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    throw new appError_1.AppError("User not authenticated", 401);
                }
                const bookings = yield booking_service_1.bookingService.getUserFlightBookings(userId);
                return res.status(200).json({
                    status: "success",
                    data: { bookings },
                });
            }
            catch (error) {
                logger_1.logger.error("Error getting user flight bookings", error);
                next(error);
            }
        });
    },
    /**
     * Get flight booking details
     * @route GET /api/bookings/flights/:id
     * @access Private
     */
    getFlightBookingDetails(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    throw new appError_1.AppError("User not authenticated", 401);
                }
                const booking = yield booking_service_1.bookingService.getFlightBookingDetails(id, userId);
                return res.status(200).json({
                    status: "success",
                    data: { booking },
                });
            }
            catch (error) {
                logger_1.logger.error("Error getting flight booking details", error);
                next(error);
            }
        });
    },
};
//# sourceMappingURL=booking.controller.js.map