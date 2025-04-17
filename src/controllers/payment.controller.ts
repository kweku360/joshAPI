import { Request, Response, NextFunction } from "express";
import { paymentService } from "../services/payment.service";
import { bookingService } from "../services/booking.service";
import { emailService } from "../services/email.service";
import { AppError } from "../utils/appError";
import { logger } from "../utils/logger";
import { BookingStatus, PaymentStatus } from "../types/enums";
import crypto from "crypto";
import config from "../config";
import { PaymentCreateParams, PaymentData } from "../types/payment";
import { PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { z } from "zod";

// Initialize Prisma client
const prisma = new PrismaClient();

// Schema for payment initialization
const paymentInitSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  email: z.string().email(),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  paymentMethod: z.string().default("paystack"),
  metadata: z.record(z.any()).optional(),
});

// Validate request helper function
const validateRequest = <T extends z.ZodType<any, any>>(
  data: unknown,
  schema: T
): { value: z.infer<T>; error: string | null } => {
  try {
    const value = schema.parse(data);
    return { value, error: null };
  } catch (err) {
    if (err instanceof ZodError) {
      return { value: {} as z.infer<T>, error: err.message };
    }
    return { value: {} as z.infer<T>, error: "Invalid input" };
  }
};

// Payment Controller
export const paymentController = {
  /**
   * Initialize a payment
   * @route POST /api/payments/initialize
   */
  async initializePayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Validate request body
      const { value, error } = validateRequest(req.body, paymentInitSchema);
      if (error) {
        throw new AppError(error, 400);
      }

      // Get user ID from authenticated session
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError("Authentication required", 401);
      }

      // Create payment record first
      const paymentParams: PaymentCreateParams = {
        bookingId: value.bookingId,
        userId,
        amount: value.amount,
        currency: value.currency,
        paymentMethod: value.paymentMethod,
        successUrl: value.returnUrl,
        cancelUrl: value.cancelUrl,
        customerEmail: value.email,
        customerName: req.user?.name || undefined,
        metadata: value.metadata,
      };

      const payment = await paymentService.createPayment(paymentParams);

      // Process payment with Paystack
      const paymentUrl = await paymentService.processPaymentWithPaystack(
        payment.id,
        value.email
      );

      res.status(200).json({
        status: "success",
        data: {
          paymentId: payment.id,
          transactionId: payment.transactionId,
          authorizationUrl: paymentUrl.authorization_url,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verify a payment
   * @route GET /api/payments/verify/:reference
   */
  async verifyPayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { reference } = req.params;

      if (!reference) {
        throw new AppError("Payment reference is required", 400);
      }

      const verificationResult = await paymentService.verifyPaystackPayment(reference);

      // Get payment details after verification
      const payment = await paymentService.getPaymentByTransactionId(reference);

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
    } catch (error) {
      next(error);
    }
  },

  /**
   * Handle Paystack webhook
   * @route POST /api/payments/webhook
   */
  async handleWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Verify webhook signature if available
      const signature = req.headers["x-paystack-signature"] as string;
      
      if (signature && config.paystack.webhookSecret) {
        const hash = crypto
          .createHmac("sha512", config.paystack.webhookSecret)
          .update(JSON.stringify(req.body))
          .digest("hex");
          
        if (hash !== signature) {
          throw new AppError("Invalid webhook signature", 400);
        }
      }
      
      const event = req.body;
      
      // Handle event based on type
      if (event && event.event) {
        switch (event.event) {
          case "charge.success":
            await paymentController.handleSuccessfulPayment(event.data);
            break;
          
          case "transfer.success":
            await paymentController.handleSuccessfulTransfer(event.data);
            break;
            
          case "charge.failed":
            await paymentController.handleFailedPayment(event.data);
            break;
            
          case "refund.processed":
            await paymentController.handleRefund(event.data);
            break;
            
          default:
            logger.info(`Unhandled Paystack event: ${event.event}`);
        }
      }
      
      // Return 200 OK to acknowledge receipt of the webhook
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error("Error processing webhook", error);
      // Always return 200 for webhooks, even on errors
      res.status(200).json({ received: true });
    }
  },

  /**
   * Handle successful payment event
   * @param data Payment data from webhook
   */
  async handleSuccessfulPayment(data: any): Promise<void> {
    if (!data || !data.reference) {
      logger.error("Invalid payment data in webhook");
      return;
    }
    
    try {
      // Get payment by reference
      const payment = await paymentService.getPaymentByTransactionId(data.reference);
      
      // Update payment status
      const paymentData: PaymentData = {
        reference: data.reference,
        processor: "paystack",
        transactionId: data.reference,
        amount: data.amount / 100,
        currency: data.currency,
        metadata: data.metadata || {},
        webhookData: data,
        processedAt: new Date().toISOString(),
        status: PaymentStatus.COMPLETED,
        paymentMethod: payment.paymentMethod || "paystack"
      };
      
      await paymentService.updatePaymentStatus(payment.id, PaymentStatus.COMPLETED, paymentData);
      
      // Update booking status
      if (payment.bookingId) {
        await bookingService.updateBookingStatus(
          payment.bookingId,
          BookingStatus.CONFIRMED
        );
        
        // Get booking for email notifications
        const booking = await bookingService.getBookingById(payment.bookingId);
        
        // Send confirmation email if user exists
        const user = await prisma.user.findUnique({
          where: { id: payment.userId },
        });
        
        if (user) {
          await emailService.sendPaymentConfirmationEmail(
            user.email,
            booking.bookingReference,
            payment.amount,
            payment.currency
          );
        }
      }
    } catch (error) {
      logger.error(`Error handling successful payment: ${error}`);
    }
  },

  /**
   * Handle successful transfer event
   * @param data Transfer data from webhook
   */
  async handleSuccessfulTransfer(data: any): Promise<void> {
    // Handle transfer success - can be used for refunds or payouts
    logger.info("Successful transfer event", { reference: data?.reference });
  },

  /**
   * Handle failed payment event
   * @param data Failed payment data from webhook
   */
  async handleFailedPayment(data: any): Promise<void> {
    if (!data || !data.reference) {
      logger.error("Invalid failed payment data in webhook");
      return;
    }
    
    try {
      // Get payment by reference
      const payment = await paymentService.getPaymentByTransactionId(data.reference);
      
      // Update payment status
      const paymentData: PaymentData = {
        reference: data.reference,
        processor: "paystack",
        transactionId: data.reference,
        amount: data.amount / 100,
        currency: data.currency,
        metadata: data.metadata || {},
        webhookData: data,
        failedAt: new Date().toISOString(),
        failureReason: data.gateway_response || "Payment failed",
        status: PaymentStatus.FAILED,
        paymentMethod: payment.paymentMethod || "paystack"
      };
      
      await paymentService.updatePaymentStatus(payment.id, PaymentStatus.FAILED, paymentData);
      
      // Update booking status to reflect failed payment
      if (payment.bookingId) {
        await bookingService.updateBookingStatus(
          payment.bookingId,
          "PAYMENT_FAILED" as any // Temporary fix for type compatibility
        );
      }
    } catch (error) {
      logger.error(`Error handling failed payment: ${error}`);
    }
  },

  /**
   * Handle refund event
   * @param data Refund data from webhook
   */
  async handleRefund(data: any): Promise<void> {
    if (!data || !data.reference) {
      logger.error("Invalid refund data in webhook");
      return;
    }
    
    try {
      // Get payment by reference
      const payment = await paymentService.getPaymentByTransactionId(data.reference);
      
      // Update payment status
      const paymentData: PaymentData = {
        reference: data.reference,
        processor: "paystack",
        transactionId: data.reference,
        amount: data.amount / 100,
        currency: data.currency,
        metadata: data.metadata || {},
        webhookData: data,
        refundedAt: new Date().toISOString(),
        refundAmount: data.amount / 100, // Convert from smallest currency unit
        status: PaymentStatus.REFUNDED,
        paymentMethod: payment.paymentMethod || "paystack"
      };
      
      await paymentService.updatePaymentStatus(payment.id, PaymentStatus.REFUNDED, paymentData);
      
      // Update booking status to reflect refund
      if (payment.bookingId) {
        await bookingService.updateBookingStatus(
          payment.bookingId,
          "REFUNDED" as any // Temporary fix for type compatibility
        );
        
        // Get booking for email notifications
        const booking = await bookingService.getBookingById(payment.bookingId);
        
        // Get user for email notification
        const user = await prisma.user.findUnique({
          where: { id: payment.userId },
        });
        
        if (user) {
          await emailService.sendRefundConfirmationEmail(
            user.email,
            booking.bookingReference,
            data.amount / 100, // Convert from smallest currency unit
            payment.currency
          );
        }
      }
    } catch (error) {
      logger.error(`Error handling refund: ${error}`);
    }
  },

  /**
   * Get user's payment history
   * @route GET /api/payments/history
   */
  async getPaymentHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError("Authentication required", 401);
      }

      const payments = await paymentService.getUserPayments(userId);

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
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get payment details
   * @route GET /api/payments/:paymentId
   */
  async getPaymentDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { paymentId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError("Authentication required", 401);
      }

      const payment = await paymentService.getPaymentById(paymentId);

      // Check if the payment belongs to this user or user is admin
      if (payment.userId !== userId && req.user?.role !== "ADMIN") {
        throw new AppError("You do not have permission to view this payment", 403);
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
    } catch (error) {
      next(error);
    }
  },
};
