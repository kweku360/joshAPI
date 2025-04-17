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
exports.bookingService = void 0;
const client_1 = require("@prisma/client");
const node_cache_1 = __importDefault(require("node-cache"));
const amadeus_service_1 = require("./amadeus.service");
const email_service_1 = require("./email.service");
const appError_1 = require("../utils/appError");
const logger_1 = require("../utils/logger");
const perf_hooks_1 = require("perf_hooks");
const booking_1 = require("../types/booking");
const flight_service_1 = require("./flight.service");
const prisma = new client_1.PrismaClient();
// Booking cache for frequently accessed bookings
const bookingCache = new node_cache_1.default({
    stdTTL: 600, // 10 minutes cache
    checkperiod: 120,
    useClones: false,
});
exports.bookingService = {
    /**
     * Update booking with Amadeus order information
     * @param bookingId The booking ID
     * @param amadeusOrderId Amadeus order ID
     * @param amadeusOrderData Amadeus order data
     * @returns Updated booking
     */
    updateBookingWithAmadeusOrder(bookingId, amadeusOrderId, amadeusOrderData) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.logger.info(`Updating booking with Amadeus order: ${bookingId}`);
            // Invalidate cache since we're changing the booking
            bookingCache.del(`booking_${bookingId}`);
            // Get the booking first to get the reference for cache invalidation
            const booking = yield prisma.booking.findUnique({
                where: { id: bookingId },
            });
            if (booking) {
                bookingCache.del(`booking_ref_${booking.bookingReference}`);
            }
            const updatedBooking = yield prisma.booking.update({
                where: { id: bookingId },
                data: {
                    amadeusOrderId,
                    amadeusOrderData,
                },
            });
            return (0, booking_1.asPrismaBooking)(updatedBooking);
        });
    },
    /**
     * Update booking with guest user ID after guest account creation
     * @param bookingId The booking ID
     * @param userId The user ID to associate
     * @returns Updated booking
     */
    updateBookingUser(bookingId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.logger.info(`Updating booking with user: ${bookingId}, ${userId}`);
            // Invalidate cache
            bookingCache.del(`booking_${bookingId}`);
            // Get the booking first to get the reference for cache invalidation
            const booking = yield prisma.booking.findUnique({
                where: { id: bookingId },
            });
            if (booking) {
                bookingCache.del(`booking_ref_${booking.bookingReference}`);
            }
            const updatedBooking = yield prisma.booking.update({
                where: { id: bookingId },
                data: { userId },
            });
            // Update cache with new booking data
            const typedBooking = (0, booking_1.asPrismaBooking)(updatedBooking);
            bookingCache.set(`booking_${bookingId}`, typedBooking);
            bookingCache.set(`booking_ref_${updatedBooking.bookingReference}`, typedBooking);
            return typedBooking;
        });
    },
    /**
     * Create a new booking
     */
    createBooking(userId_1, flightOfferId_1, flightOfferData_1, passengerDetails_1, totalAmount_1) {
        return __awaiter(this, arguments, void 0, function* (userId, flightOfferId, flightOfferData, passengerDetails, totalAmount, currency = "USD") {
            const startTime = perf_hooks_1.performance.now();
            // Generate booking reference
            const bookingReference = `JT${Math.floor(100000 + Math.random() * 900000)}`;
            // Set expiration time (offer valid for 1 hour)
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 1);
            // Determine contact email from passenger details or primary passenger
            const contactEmail = passengerDetails[0].email;
            const contactPhone = passengerDetails[0].phone;
            logger_1.logger.info(`Creating booking for ${userId ? `user ${userId}` : "guest"}`, {
                flightOfferId,
                bookingReference,
                totalAmount,
                currency,
                contactEmail,
            });
            try {
                // Create booking in database
                const booking = yield prisma.booking.create({
                    data: {
                        bookingReference,
                        userId, // Can be null for guest bookings
                        flightOfferData,
                        passengerDetails,
                        contactEmail,
                        contactPhone,
                        totalAmount,
                        currency,
                        status: "PENDING",
                        expiresAt,
                    },
                });
                // Send booking confirmation email
                try {
                    yield email_service_1.emailService.sendBookingConfirmationEmail(contactEmail, bookingReference, flightOfferData, passengerDetails, totalAmount, currency);
                }
                catch (error) {
                    logger_1.logger.error("Failed to send booking confirmation email", error);
                    // Don't throw error here, as the booking was created successfully
                }
                // Add to cache
                const typedBooking = (0, booking_1.asPrismaBooking)(booking);
                bookingCache.set(`booking_${booking.id}`, typedBooking);
                bookingCache.set(`booking_ref_${bookingReference}`, typedBooking);
                // Log performance
                const duration = perf_hooks_1.performance.now() - startTime;
                logger_1.logger.debug(`Booking creation completed in ${duration}ms`, {
                    bookingId: booking.id,
                    responseTime: duration,
                });
                return typedBooking;
            }
            catch (error) {
                logger_1.logger.error("Booking creation error", error);
                throw new appError_1.AppError(error instanceof appError_1.AppError ? error.message : "Failed to create booking", error instanceof appError_1.AppError ? error.statusCode : 500);
            }
        });
    },
    /**
     * Get a booking by ID
     */
    getBookingById(bookingId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check cache first
            const cachedBooking = bookingCache.get(`booking_${bookingId}`);
            if (cachedBooking) {
                logger_1.logger.info(`Retrieved booking from cache: ${bookingId}`);
                return cachedBooking;
            }
            const booking = yield prisma.booking.findUnique({
                where: { id: bookingId },
            });
            if (!booking) {
                throw new appError_1.AppError("Booking not found", 404);
            }
            // Cache the result
            const typedBooking = (0, booking_1.asPrismaBooking)(booking);
            bookingCache.set(`booking_${bookingId}`, typedBooking);
            return typedBooking;
        });
    },
    /**
     * Get a booking by reference
     */
    getBookingByReference(bookingReference) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check cache first
            const cachedBooking = bookingCache.get(`booking_ref_${bookingReference}`);
            if (cachedBooking) {
                logger_1.logger.info(`Retrieved booking from cache by reference: ${bookingReference}`);
                return cachedBooking;
            }
            const booking = yield prisma.booking.findUnique({
                where: { bookingReference },
            });
            if (!booking) {
                throw new appError_1.AppError("Booking not found", 404);
            }
            // Cache the result
            const typedBooking = (0, booking_1.asPrismaBooking)(booking);
            bookingCache.set(`booking_ref_${bookingReference}`, typedBooking);
            bookingCache.set(`booking_${booking.id}`, typedBooking);
            return typedBooking;
        });
    },
    /**
     * Get all bookings for a user
     */
    getUserBookings(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // This endpoint might be too dynamic to cache effectively
            // But we can add database-level optimizations
            const bookings = yield prisma.booking.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
            });
            return bookings.map((booking) => (0, booking_1.asPrismaBooking)(booking));
        });
    },
    /**
     * Update booking status
     */
    updateBookingStatus(bookingId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.logger.info(`Updating booking status: ${bookingId} to ${status}`);
            // Invalidate cache since we're changing the booking
            bookingCache.del(`booking_${bookingId}`);
            // Get the booking first to get the reference for cache invalidation
            const booking = yield prisma.booking.findUnique({
                where: { id: bookingId },
            });
            if (booking) {
                bookingCache.del(`booking_ref_${booking.bookingReference}`);
            }
            const updatedBooking = yield prisma.booking.update({
                where: { id: bookingId },
                data: { status: status }, // Cast to any to work around Prisma enum type issues
            });
            // Update cache with new booking data
            const typedBooking = (0, booking_1.asPrismaBooking)(updatedBooking);
            bookingCache.set(`booking_${bookingId}`, typedBooking);
            bookingCache.set(`booking_ref_${updatedBooking.bookingReference}`, typedBooking);
            return typedBooking;
        });
    },
    /**
     * Cancel a booking
     */
    cancelBooking(bookingId) {
        return __awaiter(this, void 0, void 0, function* () {
            const booking = yield prisma.booking.findUnique({
                where: { id: bookingId },
            });
            if (!booking) {
                throw new appError_1.AppError("Booking not found", 404);
            }
            if (booking.status === "CANCELLED") {
                throw new appError_1.AppError("Booking is already cancelled", 400);
            }
            // In a real application, you would implement cancellation logic with the airline
            // and handle refunds if applicable
            logger_1.logger.info(`Cancelling booking: ${bookingId}`);
            // Invalidate cache
            bookingCache.del(`booking_${bookingId}`);
            bookingCache.del(`booking_ref_${booking.bookingReference}`);
            const cancelledBooking = yield prisma.booking.update({
                where: { id: bookingId },
                data: { status: "CANCELLED" },
            });
            try {
                // Get user email for notification
                const user = yield prisma.user.findUnique({
                    where: { id: booking.userId || undefined },
                });
                if (user) {
                    // Send cancellation email
                    yield email_service_1.emailService.sendBookingCancellationEmail(user.email, booking.bookingReference);
                }
            }
            catch (error) {
                logger_1.logger.error("Failed to send booking cancellation email", error);
                // Don't throw error here, as the booking was cancelled successfully
            }
            // Update cache with new booking data
            const typedBooking = (0, booking_1.asPrismaBooking)(cancelledBooking);
            bookingCache.set(`booking_${bookingId}`, typedBooking);
            bookingCache.set(`booking_ref_${cancelledBooking.bookingReference}`, typedBooking);
            return typedBooking;
        });
    },
    /**
     * Generate e-ticket for a booking
     */
    generateETicket(bookingId) {
        return __awaiter(this, void 0, void 0, function* () {
            const booking = yield prisma.booking.findUnique({
                where: { id: bookingId },
            });
            if (!booking) {
                throw new appError_1.AppError("Booking not found", 404);
            }
            if (booking.status !== "CONFIRMED") {
                throw new appError_1.AppError("Cannot generate e-ticket for unconfirmed booking", 400);
            }
            // If e-ticket already exists, return it
            if (booking.eTicketUrl) {
                return booking.eTicketUrl;
            }
            logger_1.logger.info(`Generating e-ticket for booking: ${bookingId}`);
            // In a real application, you would generate a PDF e-ticket
            // and store it in a cloud storage service
            // For now, we'll just generate a fake URL
            const eTicketUrl = `https://joshtravels.com/e-tickets/${booking.bookingReference}.pdf`;
            // Update booking with e-ticket URL
            yield prisma.booking.update({
                where: { id: bookingId },
                data: { eTicketUrl },
            });
            // Invalidate cache since we've updated the booking
            bookingCache.del(`booking_${bookingId}`);
            bookingCache.del(`booking_ref_${booking.bookingReference}`);
            return eTicketUrl;
        });
    },
    /**
     * Create a flight booking
     * @param userId User ID
     * @param flightOffer Flight offer
     * @param travelers Traveler information
     * @param contact Contact information
     * @returns Booking information
     */
    createFlightBooking(userId, flightOffer, travelers, contact) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1. Validate the flight offer (price verification)
                const pricingResponse = yield flight_service_1.flightService.priceFlightOffers(flightOffer);
                // Check if price has changed
                const currentPrice = pricingResponse.data.flightOffers[0].price.total;
                const originalPrice = flightOffer.price.total;
                if (currentPrice !== originalPrice) {
                    throw new appError_1.AppError(`Flight price has changed from ${originalPrice} to ${currentPrice}. Please confirm the new price.`, 400);
                }
                // 2. Create booking with Amadeus
                const bookingResponse = yield flight_service_1.flightService.createFlightBooking(flightOffer, travelers, contact);
                const bookingReference = bookingResponse.data.associatedRecords[0].reference;
                // 3. Store booking details in database
                const booking = yield prisma.flightBooking.create({
                    data: {
                        userId,
                        bookingReference,
                        flightOfferData: flightOffer,
                        totalPrice: parseFloat(currentPrice),
                        currency: flightOffer.price.currency,
                        bookingStatus: "CONFIRMED", // Cast to any to work around Prisma enum type issues
                        paymentStatus: "COMPLETED", // Cast to any to work around Prisma enum type issues
                        contactEmail: contact.emailAddress,
                        contactPhone: contact.phones[0].number,
                        passengers: travelers,
                    },
                });
                // 4. Send confirmation email
                const user = yield prisma.user.findUnique({
                    where: { id: userId },
                });
                if (user) {
                    yield email_service_1.emailService.sendFlightBookingConfirmation(user.email, user.name || "Traveler", bookingReference, flightOffer);
                }
                logger_1.logger.info(`Flight booking created: ${bookingReference} for user ${userId}`);
                return {
                    booking,
                    amadeus: bookingResponse.data,
                };
            }
            catch (error) {
                logger_1.logger.error("Error creating flight booking", error);
                // If Amadeus booking was created but database storage failed,
                // we should log this for manual reconciliation
                if (error.bookingReference) {
                    logger_1.logger.error(`Booking created in Amadeus but failed to store in database: ${error.bookingReference}`);
                }
                throw error;
            }
        });
    },
    /**
     * Get user's flight bookings
     * @param userId User ID
     * @returns List of bookings
     */
    getUserFlightBookings(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma.flightBooking.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
            });
        });
    },
    /**
     * Get flight booking details
     * @param bookingId Booking ID
     * @param userId User ID
     * @returns Booking details
     */
    getFlightBookingDetails(bookingId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const booking = yield prisma.flightBooking.findFirst({
                where: {
                    id: bookingId,
                    userId,
                },
            });
            if (!booking) {
                throw new appError_1.AppError("Booking not found", 404);
            }
            return booking;
        });
    },
    /**
     * Confirm booking with Amadeus
     */
    confirmBookingWithAmadeus(bookingId) {
        return __awaiter(this, void 0, void 0, function* () {
            const booking = yield prisma.booking.findUnique({
                where: { id: bookingId },
                include: { user: true },
            });
            if (!booking) {
                throw new appError_1.AppError("Booking not found", 404);
            }
            if (booking.status !== "PENDING") {
                throw new appError_1.AppError("Booking is not in pending status", 400);
            }
            logger_1.logger.info(`Confirming booking with Amadeus: ${bookingId}`);
            try {
                // Format travelers for Amadeus API
                const travelers = Array.isArray(booking.passengerDetails)
                    ? booking.passengerDetails.map((passenger) => ({
                        id: passenger.id,
                        dateOfBirth: passenger.dateOfBirth,
                        name: {
                            firstName: passenger.firstName,
                            lastName: passenger.lastName,
                        },
                        gender: passenger.gender,
                        contact: {
                            emailAddress: passenger.email || (booking.user ? booking.user.email : ""),
                            phones: passenger.phone
                                ? [
                                    {
                                        deviceType: "MOBILE",
                                        number: passenger.phone,
                                    },
                                ]
                                : undefined,
                        },
                        documents: passenger.documentType
                            ? [
                                {
                                    documentType: passenger.documentType,
                                    number: passenger.documentNumber,
                                    issuanceCountry: passenger.documentIssuingCountry,
                                    expiryDate: passenger.documentExpiryDate,
                                },
                            ]
                            : undefined,
                    }))
                    : [];
                // Create flight order with Amadeus
                const order = yield amadeus_service_1.amadeusService.createFlightOrder(booking.flightOfferData, travelers);
                // Update booking status and add order details
                const confirmedBooking = yield prisma.booking.update({
                    where: { id: bookingId },
                    data: {
                        status: "CONFIRMED",
                        amadeusOrderId: order.id,
                        amadeusOrderData: order,
                    },
                });
                // Invalidate cache
                bookingCache.del(`booking_${bookingId}`);
                bookingCache.del(`booking_ref_${booking.bookingReference}`);
                // Send confirmation email
                if (booking.user) {
                    yield email_service_1.emailService.sendBookingConfirmationEmail(booking.user.email, booking.bookingReference, booking.flightOfferData, Array.isArray(booking.passengerDetails)
                        ? booking.passengerDetails
                        : [], booking.totalAmount, booking.currency);
                }
                return (0, booking_1.asPrismaBooking)(confirmedBooking);
            }
            catch (error) {
                logger_1.logger.error("Failed to confirm booking with Amadeus", error);
                // Update booking status to failed
                yield prisma.booking.update({
                    where: { id: bookingId },
                    data: {
                        status: "FAILED",
                        failureReason: error instanceof Error ? error.message : "Unknown error",
                    },
                });
                // Invalidate cache
                bookingCache.del(`booking_${bookingId}`);
                bookingCache.del(`booking_ref_${booking.bookingReference}`);
                throw new appError_1.AppError("Failed to confirm booking with Amadeus", 500, {
                    originalError: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    },
    /**
     * Clear booking cache - useful for testing
     */
    clearCache() {
        bookingCache.flushAll();
        logger_1.logger.info("Booking cache cleared");
    },
};
//# sourceMappingURL=booking.service.js.map