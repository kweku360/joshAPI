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
exports.paymentService = void 0;
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const appError_1 = require("../utils/appError");
const logger_1 = require("../utils/logger");
const booking_service_1 = require("./booking.service");
const email_service_1 = require("./email.service");
const config_1 = __importDefault(require("../config"));
const paystack_api_1 = __importDefault(require("paystack-api"));
const enums_1 = require("../types/enums");
const prisma = new client_1.PrismaClient();
const paystack = (0, paystack_api_1.default)(config_1.default.paystack.secretKey);
/**
 * Payment service with Paystack integration
 */
exports.paymentService = {
    /**
     * Create a new payment
     * @param params Payment creation parameters
     * @returns Created payment
     */
    createPayment(params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.logger.info(`Creating payment for booking: ${params.bookingId}`, {
                    amount: params.amount,
                    currency: params.currency,
                    method: params.paymentMethod,
                });
                // Check if booking exists
                const booking = yield prisma.booking.findUnique({
                    where: { id: params.bookingId },
                });
                if (!booking) {
                    throw new appError_1.AppError("Booking not found", 404);
                }
                // Generate transaction ID
                const transactionId = `PAYM-${(0, uuid_1.v4)().substring(0, 8).toUpperCase()}`;
                // Create payment in database
                const payment = yield prisma.payment.create({
                    data: {
                        transactionId,
                        bookingId: params.bookingId,
                        userId: params.userId,
                        amount: params.amount,
                        currency: params.currency,
                        paymentMethod: params.paymentMethod,
                        status: enums_1.PaymentStatus.PENDING,
                        paymentData: {
                            successUrl: params.successUrl,
                            cancelUrl: params.cancelUrl,
                            customerEmail: params.customerEmail,
                            customerName: params.customerName,
                            metadata: params.metadata || {},
                        },
                    },
                });
                logger_1.logger.info(`Payment created: ${payment.id}`, {
                    transactionId,
                    amount: params.amount,
                });
                return payment;
            }
            catch (error) {
                if (error instanceof appError_1.AppError) {
                    throw error;
                }
                logger_1.logger.error("Error creating payment", error);
                throw new appError_1.AppError("Failed to create payment", 500);
            }
        });
    },
    /**
     * Get a payment by ID
     * @param paymentId Payment ID
     * @returns Payment information
     */
    getPaymentById(paymentId) {
        return __awaiter(this, void 0, void 0, function* () {
            const payment = yield prisma.payment.findUnique({
                where: { id: paymentId },
            });
            if (!payment) {
                throw new appError_1.AppError("Payment not found", 404);
            }
            return payment;
        });
    },
    /**
     * Get a payment by transaction ID
     * @param transactionId Transaction ID
     * @returns Payment information
     */
    getPaymentByTransactionId(transactionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const payment = yield prisma.payment.findFirst({
                where: { transactionId },
            });
            if (!payment) {
                throw new appError_1.AppError("Payment not found", 404);
            }
            return payment;
        });
    },
    /**
     * Update payment status
     * @param paymentId Payment ID
     * @param status New payment status
     * @param paymentData Additional payment data
     * @returns Updated payment
     */
    updatePaymentStatus(paymentId, status, paymentData) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingPayment = yield prisma.payment.findUnique({
                where: { id: paymentId },
            });
            if (!existingPayment) {
                throw new appError_1.AppError("Payment not found", 404);
            }
            // Get booking associated with this payment
            const booking = yield prisma.booking.findUnique({
                where: { id: existingPayment.bookingId },
            });
            if (!booking) {
                logger_1.logger.warn(`Booking not found for payment: ${paymentId}`);
            }
            // Prepare data for update
            const updateData = {
                status,
            };
            if (paymentData) {
                // Merge existing payment data with new data
                const existingData = existingPayment.paymentData || {};
                updateData.paymentData = Object.assign(Object.assign({}, existingData), paymentData);
            }
            // Update payment in database
            const updatedPayment = yield prisma.payment.update({
                where: { id: paymentId },
                data: updateData,
            });
            logger_1.logger.info(`Payment status updated: ${paymentId} to ${status}`, {
                bookingId: existingPayment.bookingId,
            });
            return updatedPayment;
        });
    },
    /**
     * Process a payment through Paystack
     * @param paymentId Payment ID to process
     * @param email Customer email
     * @returns Transaction initialization data
     */
    processPaymentWithPaystack(paymentId, email) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Get payment details
            const payment = yield this.getPaymentById(paymentId);
            // Get booking details
            const booking = yield prisma.booking.findUnique({
                where: { id: payment.bookingId },
            });
            if (!booking) {
                throw new appError_1.AppError("Booking not found", 404);
            }
            try {
                // Initialize transaction with Paystack
                const result = yield paystack.transaction.initialize({
                    amount: payment.amount * 100, // Paystack requires amount in kobo (smallest currency unit)
                    email,
                    reference: payment.transactionId,
                    currency: payment.currency,
                    callback_url: (_a = payment.paymentData) === null || _a === void 0 ? void 0 : _a.successUrl,
                    metadata: {
                        bookingId: payment.bookingId,
                        paymentId: payment.id,
                        bookingReference: booking.bookingReference,
                        userId: payment.userId,
                        custom_fields: [
                            {
                                display_name: "Booking Reference",
                                variable_name: "booking_reference",
                                value: booking.bookingReference,
                            },
                        ],
                    },
                });
                // Update payment with Paystack reference
                yield this.updatePaymentStatus(payment.id, enums_1.PaymentStatus.PENDING, {
                    paystackReference: result.data.reference,
                    authorization_url: result.data.authorization_url,
                    access_code: result.data.access_code,
                });
                return {
                    authorization_url: result.data.authorization_url,
                    access_code: result.data.access_code,
                    reference: result.data.reference,
                };
            }
            catch (error) {
                logger_1.logger.error("Error processing payment with Paystack", error);
                throw new appError_1.AppError("Failed to process payment", 500);
            }
        });
    },
    /**
     * Verify a payment with Paystack
     * @param reference Paystack reference
     * @returns Verification result
     */
    verifyPaystackPayment(reference) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Verify transaction with Paystack
                const result = yield paystack.transaction.verify({ reference });
                // Find payment with this reference
                const payment = yield prisma.payment.findFirst({
                    where: {
                        paymentData: {
                            path: ["paystackReference"],
                            equals: reference,
                        },
                    },
                });
                if (!payment) {
                    throw new appError_1.AppError("Payment not found for reference: " + reference, 404);
                }
                // Update payment based on verification result
                if (result.data.status === "success") {
                    yield this.updatePaymentStatus(payment.id, enums_1.PaymentStatus.COMPLETED, {
                        verificationData: result.data,
                        verifiedAt: new Date().toISOString(),
                        processor: "paystack",
                        receiptUrl: result.data.receipt_url,
                    });
                    // Update booking status to CONFIRMED
                    yield booking_service_1.bookingService.updateBookingStatus(payment.bookingId, "CONFIRMED" // Temporary fix for type compatibility
                    );
                    // Get user email
                    const booking = yield prisma.booking.findUnique({
                        where: { id: payment.bookingId },
                        include: { user: true },
                    });
                    if (booking && booking.user) {
                        // Send payment confirmation email
                        yield email_service_1.emailService.sendPaymentConfirmationEmail(booking.user.email, booking.bookingReference, payment.amount, payment.currency);
                    }
                }
                else if (result.data.status === "failed" ||
                    result.data.status === "abandoned") {
                    yield this.updatePaymentStatus(payment.id, enums_1.PaymentStatus.FAILED, {
                        verificationData: result.data,
                        verifiedAt: new Date().toISOString(),
                        processor: "paystack",
                        errorMessage: result.data.gateway_response,
                    });
                    // Update booking status to reflect failed payment
                    yield booking_service_1.bookingService.updateBookingStatus(payment.bookingId, "PAYMENT_FAILED" // Temporary fix for type compatibility
                    );
                }
                return result.data;
            }
            catch (error) {
                logger_1.logger.error("Error verifying Paystack payment", error);
                throw new appError_1.AppError("Failed to verify payment", 500);
            }
        });
    },
    /**
     * Process a refund
     * @param paymentId Payment ID to refund
     * @param amount Amount to refund, defaults to full amount
     * @returns Refund result
     */
    processRefund(paymentId, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            const payment = yield this.getPaymentById(paymentId);
            if (payment.status !== "COMPLETED") {
                throw new appError_1.AppError("Cannot refund a payment that is not completed", 400);
            }
            // For now, let's simulate a refund since Paystack refund API requires approval
            const refundAmount = amount || payment.amount;
            // Update payment status to REFUNDED
            const updatedPayment = yield this.updatePaymentStatus(payment.id, enums_1.PaymentStatus.REFUNDED, {
                refundedAt: new Date().toISOString(),
                refundedAmount: refundAmount,
                processor: "paystack",
            });
            // Update booking status to REFUNDED
            if (payment.bookingId) {
                yield booking_service_1.bookingService.updateBookingStatus(payment.bookingId, "REFUNDED" // Temporary fix for type compatibility
                );
                // Get booking details
                const booking = yield prisma.booking.findUnique({
                    where: { id: payment.bookingId },
                    include: { user: true },
                });
                if (booking && booking.user) {
                    // Send refund confirmation email
                    yield email_service_1.emailService.sendRefundConfirmationEmail(booking.user.email, booking.bookingReference, refundAmount, payment.currency);
                }
            }
            return updatedPayment;
        });
    },
    /**
     * Get payment by booking ID
     * @param bookingId Booking ID
     * @returns Payment
     */
    getPaymentByBookingId(bookingId) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield prisma.payment.findFirst({
                where: { bookingId },
                orderBy: { createdAt: "desc" },
            }));
        });
    },
    /**
     * Get all user payments
     * @param userId User ID
     * @returns List of payments
     */
    getUserPayments(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield prisma.payment.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
            }));
        });
    },
    /**
     * Get payment methods for a user
     * @param userId User ID
     * @returns Payment methods
     */
    getPaymentMethods(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield prisma.payment.findMany({
                where: {
                    userId,
                    status: enums_1.PaymentStatus.COMPLETED,
                },
                distinct: ["paymentMethod"],
                orderBy: { createdAt: "desc" },
            }));
        });
    },
};
//# sourceMappingURL=payment.service.js.map