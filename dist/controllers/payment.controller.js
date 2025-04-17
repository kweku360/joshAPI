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
exports.paymentController = void 0;
const payment_service_1 = require("../services/payment.service");
const booking_service_1 = require("../services/booking.service");
const email_service_1 = require("../services/email.service");
const appError_1 = require("../utils/appError");
const logger_1 = require("../utils/logger");
const enums_1 = require("../types/enums");
const crypto_1 = __importDefault(require("crypto"));
const config_1 = __importDefault(require("../config"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const zod_2 = require("zod");
// Initialize Prisma client
const prisma = new client_1.PrismaClient();
// Schema for payment initialization
const paymentInitSchema = zod_2.z.object({
    bookingId: zod_2.z.string().uuid(),
    amount: zod_2.z.number().positive(),
    currency: zod_2.z.string().min(3).max(3),
    email: zod_2.z.string().email(),
    returnUrl: zod_2.z.string().url().optional(),
    cancelUrl: zod_2.z.string().url().optional(),
    paymentMethod: zod_2.z.string().default("paystack"),
    metadata: zod_2.z.record(zod_2.z.any()).optional(),
});
// Validate request helper function
const validateRequest = (data, schema) => {
    try {
        const value = schema.parse(data);
        return { value, error: null };
    }
    catch (err) {
        if (err instanceof zod_1.ZodError) {
            return { value: {}, error: err.message };
        }
        return { value: {}, error: "Invalid input" };
    }
};
// Payment Controller
exports.paymentController = {
    /**
     * Initialize a payment
     * @route POST /api/payments/initialize
     */
    initializePayment(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                // Validate request body
                const { value, error } = validateRequest(req.body, paymentInitSchema);
                if (error) {
                    throw new appError_1.AppError(error, 400);
                }
                // Get user ID from authenticated session
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    throw new appError_1.AppError("Authentication required", 401);
                }
                // Create payment record first
                const paymentParams = {
                    bookingId: value.bookingId,
                    userId,
                    amount: value.amount,
                    currency: value.currency,
                    paymentMethod: value.paymentMethod,
                    successUrl: value.returnUrl,
                    cancelUrl: value.cancelUrl,
                    customerEmail: value.email,
                    customerName: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.name) || undefined,
                    metadata: value.metadata,
                };
                const payment = yield payment_service_1.paymentService.createPayment(paymentParams);
                // Process payment with Paystack
                const paymentUrl = yield payment_service_1.paymentService.processPaymentWithPaystack(payment.id, value.email);
                res.status(200).json({
                    status: "success",
                    data: {
                        paymentId: payment.id,
                        transactionId: payment.transactionId,
                        authorizationUrl: paymentUrl.authorization_url,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        });
    },
    /**
     * Verify a payment
     * @route GET /api/payments/verify/:reference
     */
    verifyPayment(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { reference } = req.params;
                if (!reference) {
                    throw new appError_1.AppError("Payment reference is required", 400);
                }
                const verificationResult = yield payment_service_1.paymentService.verifyPaystackPayment(reference);
                // Get payment details after verification
                const payment = yield payment_service_1.paymentService.getPaymentByTransactionId(reference);
                res.status(200).json({
                    status: "success",
                    data: {
                        paymentId: payment.id,
                        transactionId: payment.transactionId,
                        bookingId: payment.bookingId,
                        status: payment.status,
                        verified: verificationResult.status === "success",
                    },
                });
            }
            catch (error) {
                next(error);
            }
        });
    },
    /**
     * Handle Paystack webhook
     * @route POST /api/payments/webhook
     */
    handleWebhook(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Verify webhook signature if available
                const signature = req.headers["x-paystack-signature"];
                if (signature && config_1.default.paystack.webhookSecret) {
                    const hash = crypto_1.default
                        .createHmac("sha512", config_1.default.paystack.webhookSecret)
                        .update(JSON.stringify(req.body))
                        .digest("hex");
                    if (hash !== signature) {
                        throw new appError_1.AppError("Invalid webhook signature", 400);
                    }
                }
                const event = req.body;
                // Handle event based on type
                if (event && event.event) {
                    switch (event.event) {
                        case "charge.success":
                            yield exports.paymentController.handleSuccessfulPayment(event.data);
                            break;
                        case "transfer.success":
                            yield exports.paymentController.handleSuccessfulTransfer(event.data);
                            break;
                        case "charge.failed":
                            yield exports.paymentController.handleFailedPayment(event.data);
                            break;
                        case "refund.processed":
                            yield exports.paymentController.handleRefund(event.data);
                            break;
                        default:
                            logger_1.logger.info(`Unhandled Paystack event: ${event.event}`);
                    }
                }
                // Return 200 OK to acknowledge receipt of the webhook
                res.status(200).json({ received: true });
            }
            catch (error) {
                logger_1.logger.error("Error processing webhook", error);
                // Always return 200 for webhooks, even on errors
                res.status(200).json({ received: true });
            }
        });
    },
    /**
     * Handle successful payment event
     * @param data Payment data from webhook
     */
    handleSuccessfulPayment(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !data.reference) {
                logger_1.logger.error("Invalid payment data in webhook");
                return;
            }
            try {
                // Get payment by reference
                const payment = yield payment_service_1.paymentService.getPaymentByTransactionId(data.reference);
                // Update payment status
                const paymentData = {
                    reference: data.reference,
                    processor: "paystack",
                    transactionId: data.reference,
                    amount: data.amount / 100,
                    currency: data.currency,
                    metadata: data.metadata || {},
                    webhookData: data,
                    processedAt: new Date().toISOString(),
                    status: enums_1.PaymentStatus.COMPLETED,
                    paymentMethod: payment.paymentMethod || "paystack"
                };
                yield payment_service_1.paymentService.updatePaymentStatus(payment.id, enums_1.PaymentStatus.COMPLETED, paymentData);
                // Update booking status
                if (payment.bookingId) {
                    yield booking_service_1.bookingService.updateBookingStatus(payment.bookingId, enums_1.BookingStatus.CONFIRMED);
                    // Get booking for email notifications
                    const booking = yield booking_service_1.bookingService.getBookingById(payment.bookingId);
                    // Send confirmation email if user exists
                    const user = yield prisma.user.findUnique({
                        where: { id: payment.userId },
                    });
                    if (user) {
                        yield email_service_1.emailService.sendPaymentConfirmationEmail(user.email, booking.bookingReference, payment.amount, payment.currency);
                    }
                }
            }
            catch (error) {
                logger_1.logger.error(`Error handling successful payment: ${error}`);
            }
        });
    },
    /**
     * Handle successful transfer event
     * @param data Transfer data from webhook
     */
    handleSuccessfulTransfer(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Handle transfer success - can be used for refunds or payouts
            logger_1.logger.info("Successful transfer event", { reference: data === null || data === void 0 ? void 0 : data.reference });
        });
    },
    /**
     * Handle failed payment event
     * @param data Failed payment data from webhook
     */
    handleFailedPayment(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !data.reference) {
                logger_1.logger.error("Invalid failed payment data in webhook");
                return;
            }
            try {
                // Get payment by reference
                const payment = yield payment_service_1.paymentService.getPaymentByTransactionId(data.reference);
                // Update payment status
                const paymentData = {
                    reference: data.reference,
                    processor: "paystack",
                    transactionId: data.reference,
                    amount: data.amount / 100,
                    currency: data.currency,
                    metadata: data.metadata || {},
                    webhookData: data,
                    failedAt: new Date().toISOString(),
                    failureReason: data.gateway_response || "Payment failed",
                    status: enums_1.PaymentStatus.FAILED,
                    paymentMethod: payment.paymentMethod || "paystack"
                };
                yield payment_service_1.paymentService.updatePaymentStatus(payment.id, enums_1.PaymentStatus.FAILED, paymentData);
                // Update booking status to reflect failed payment
                if (payment.bookingId) {
                    yield booking_service_1.bookingService.updateBookingStatus(payment.bookingId, "PAYMENT_FAILED" // Temporary fix for type compatibility
                    );
                }
            }
            catch (error) {
                logger_1.logger.error(`Error handling failed payment: ${error}`);
            }
        });
    },
    /**
     * Handle refund event
     * @param data Refund data from webhook
     */
    handleRefund(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !data.reference) {
                logger_1.logger.error("Invalid refund data in webhook");
                return;
            }
            try {
                // Get payment by reference
                const payment = yield payment_service_1.paymentService.getPaymentByTransactionId(data.reference);
                // Update payment status
                const paymentData = {
                    reference: data.reference,
                    processor: "paystack",
                    transactionId: data.reference,
                    amount: data.amount / 100,
                    currency: data.currency,
                    metadata: data.metadata || {},
                    webhookData: data,
                    refundedAt: new Date().toISOString(),
                    refundAmount: data.amount / 100, // Convert from smallest currency unit
                    status: enums_1.PaymentStatus.REFUNDED,
                    paymentMethod: payment.paymentMethod || "paystack"
                };
                yield payment_service_1.paymentService.updatePaymentStatus(payment.id, enums_1.PaymentStatus.REFUNDED, paymentData);
                // Update booking status to reflect refund
                if (payment.bookingId) {
                    yield booking_service_1.bookingService.updateBookingStatus(payment.bookingId, "REFUNDED" // Temporary fix for type compatibility
                    );
                    // Get booking for email notifications
                    const booking = yield booking_service_1.bookingService.getBookingById(payment.bookingId);
                    // Get user for email notification
                    const user = yield prisma.user.findUnique({
                        where: { id: payment.userId },
                    });
                    if (user) {
                        yield email_service_1.emailService.sendRefundConfirmationEmail(user.email, booking.bookingReference, data.amount / 100, // Convert from smallest currency unit
                        payment.currency);
                    }
                }
            }
            catch (error) {
                logger_1.logger.error(`Error handling refund: ${error}`);
            }
        });
    },
    /**
     * Get user's payment history
     * @route GET /api/payments/history
     */
    getPaymentHistory(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    throw new appError_1.AppError("Authentication required", 401);
                }
                const payments = yield payment_service_1.paymentService.getUserPayments(userId);
                res.status(200).json({
                    status: "success",
                    results: payments.length,
                    data: {
                        payments: payments.map((payment) => ({
                            id: payment.id,
                            transactionId: payment.transactionId,
                            bookingId: payment.bookingId,
                            amount: payment.amount,
                            currency: payment.currency,
                            paymentMethod: payment.paymentMethod,
                            status: payment.status,
                            createdAt: payment.createdAt,
                        })),
                    },
                });
            }
            catch (error) {
                next(error);
            }
        });
    },
    /**
     * Get payment details
     * @route GET /api/payments/:paymentId
     */
    getPaymentDetails(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { paymentId } = req.params;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    throw new appError_1.AppError("Authentication required", 401);
                }
                const payment = yield payment_service_1.paymentService.getPaymentById(paymentId);
                // Check if the payment belongs to this user or user is admin
                if (payment.userId !== userId && ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) !== "ADMIN") {
                    throw new appError_1.AppError("You do not have permission to view this payment", 403);
                }
                res.status(200).json({
                    status: "success",
                    data: {
                        payment: {
                            id: payment.id,
                            transactionId: payment.transactionId,
                            bookingId: payment.bookingId,
                            amount: payment.amount,
                            currency: payment.currency,
                            paymentMethod: payment.paymentMethod,
                            status: payment.status,
                            createdAt: payment.createdAt,
                            updatedAt: payment.updatedAt,
                        },
                    },
                });
            }
            catch (error) {
                next(error);
            }
        });
    },
};
//# sourceMappingURL=payment.controller.js.map