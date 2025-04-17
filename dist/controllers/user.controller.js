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
exports.userController = void 0;
const client_1 = require("@prisma/client");
const appError_1 = require("../utils/appError");
const validator_1 = require("../utils/validator");
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const booking_service_1 = require("../services/booking.service");
const prisma = new client_1.PrismaClient();
exports.userController = {
    getProfile(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // User is already attached to req by the protect middleware
                const user = req.user;
                // Return response
                res.status(200).json({
                    status: "success",
                    data: {
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            phone: user.phone,
                            isEmailVerified: user.isEmailVerified,
                            isPhoneVerified: user.isPhoneVerified,
                            role: user.role,
                            createdAt: user.createdAt,
                        },
                    },
                });
            }
            catch (error) {
                next(error);
            }
        });
    },
    /**
     * Get user profile with their bookings
     */
    getProfileWithBookings(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                // Get user
                const user = req.user;
                // Get recent bookings for the user (limit to 5)
                const allBookings = yield booking_service_1.bookingService.getUserBookings(userId);
                // Get recent bookings (pending or confirmed)
                const recentBookings = allBookings
                    .filter((booking) => ["PENDING", "CONFIRMED"].includes(booking.status))
                    .slice(0, 5); // Limit to 5 recent bookings
                // Return response
                res.status(200).json({
                    status: "success",
                    data: {
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            phone: user.phone,
                            isEmailVerified: user.isEmailVerified,
                            isPhoneVerified: user.isPhoneVerified,
                            role: user.role,
                            createdAt: user.createdAt,
                        },
                        recentBookings,
                        bookingsCount: {
                            total: allBookings.length,
                            pending: allBookings.filter((b) => b.status === "PENDING").length,
                            confirmed: allBookings.filter((b) => b.status === "CONFIRMED")
                                .length,
                            completed: allBookings.filter((b) => b.status === "COMPLETED")
                                .length,
                            cancelled: allBookings.filter((b) => b.status === "CANCELLED")
                                .length,
                        },
                    },
                });
            }
            catch (error) {
                logger_1.logger.error("Error fetching profile with bookings", error);
                next(error);
            }
        });
    },
    updateProfile(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate request body
                const schema = zod_1.z.object({
                    name: zod_1.z
                        .string()
                        .min(2, "Name must be at least 2 characters")
                        .optional(),
                    phone: zod_1.z.string().optional(),
                });
                const validatedData = (0, validator_1.validateRequest)(req.body, schema);
                // Update user
                const updatedUser = yield prisma.user.update({
                    where: { id: req.user.id },
                    data: {
                        name: validatedData.name,
                        phone: validatedData.phone,
                    },
                });
                logger_1.logger.info(`User profile updated: ${updatedUser.id}`);
                // Return response
                res.status(200).json({
                    status: "success",
                    data: {
                        user: {
                            id: updatedUser.id,
                            email: updatedUser.email,
                            name: updatedUser.name,
                            phone: updatedUser.phone,
                            isEmailVerified: updatedUser.isEmailVerified,
                            isPhoneVerified: updatedUser.isPhoneVerified,
                            role: updatedUser.role,
                            createdAt: updatedUser.createdAt,
                        },
                    },
                });
            }
            catch (error) {
                next(error);
            }
        });
    },
    /**
     * Get user's bookings (both recent and past)
     */
    getUserBookings(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                // Get all bookings for the user
                const allBookings = yield booking_service_1.bookingService.getUserBookings(userId);
                // Separate bookings into recent and past
                const now = new Date();
                // Recent bookings: those that are PENDING, CONFIRMED, or have future travel dates
                const recentBookings = allBookings.filter((booking) => {
                    const isPendingOrConfirmed = ["PENDING", "CONFIRMED"].includes(booking.status);
                    // Check if the booking has future travel dates
                    // This is a simplified check - we would need to parse the flight offer data
                    // to properly check departure dates
                    const hasFutureTravelDates = booking.expiresAt
                        ? booking.expiresAt > now
                        : false;
                    return isPendingOrConfirmed || hasFutureTravelDates;
                });
                // Past bookings: those that are COMPLETED, CANCELLED, or have past travel dates
                const pastBookings = allBookings.filter((booking) => {
                    return !recentBookings.includes(booking);
                });
                res.status(200).json({
                    status: "success",
                    data: {
                        recentBookings,
                        pastBookings,
                    },
                });
            }
            catch (error) {
                logger_1.logger.error("Error fetching user bookings", error);
                next(error);
            }
        });
    },
    /**
     * Delete user account
     */
    deleteAccount(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                // Validate request body to confirm deletion
                const schema = zod_1.z.object({
                    confirmation: zod_1.z.literal("DELETE_MY_ACCOUNT"),
                });
                const validatedData = (0, validator_1.validateRequest)(req.body, schema);
                // Log the deletion request
                logger_1.logger.info(`Account deletion request: ${userId}`);
                // Get user's bookings to check if there are active ones
                const bookings = yield booking_service_1.bookingService.getUserBookings(userId);
                const hasActiveBookings = bookings.some((b) => b.status === "CONFIRMED" && (!b.expiresAt || b.expiresAt > new Date()));
                if (hasActiveBookings) {
                    throw new appError_1.AppError("Cannot delete account with active bookings. Please cancel all active bookings first.", 400);
                }
                // Delete user
                yield prisma.user.delete({
                    where: { id: userId },
                });
                // Clear user's session
                res.clearCookie("jwt");
                res.status(200).json({
                    status: "success",
                    message: "Your account has been successfully deleted",
                });
            }
            catch (error) {
                logger_1.logger.error("Error deleting user account", error);
                next(error);
            }
        });
    },
};
//# sourceMappingURL=user.controller.js.map