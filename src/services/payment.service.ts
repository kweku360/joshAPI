import { PrismaClient } from "@prisma/client";
import type { Payment } from "../types/prisma";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { AppError } from "../utils/appError";
import { logger } from "../utils/logger";
import { bookingService } from "./booking.service";
import { emailService } from "./email.service";
import config from "../config";
import Paystack from "paystack-api";
import { PaymentCreateParams, PaymentData, PaymentResponse, PaymentUpdateParams } from "../types/payment";
import { BookingStatus, PaymentStatus } from "../types/enums";

const prisma = new PrismaClient();
const paystack = Paystack(config.paystack.secretKey);

/**
 * Payment service with Paystack integration
 */
export const paymentService = {
  /**
   * Create a new payment
   * @param params Payment creation parameters
   * @returns Created payment
   */
  async createPayment(params: PaymentCreateParams): Promise<PaymentResponse> {
    try {
      logger.info(`Creating payment for booking: ${params.bookingId}`, {
        amount: params.amount,
        currency: params.currency,
        method: params.paymentMethod,
      });

      // Check if booking exists
      const booking = await prisma.booking.findUnique({
        where: { id: params.bookingId },
      });

      if (!booking) {
        throw new AppError("Booking not found", 404);
      }

      // Generate transaction ID
      const transactionId = `PAYM-${uuidv4().substring(0, 8).toUpperCase()}`;

      // Create payment in database
      const payment = await prisma.payment.create({
        data: {
          transactionId,
          bookingId: params.bookingId,
          userId: params.userId,
          amount: params.amount,
          currency: params.currency,
          paymentMethod: params.paymentMethod,
          status: PaymentStatus.PENDING,
          paymentData: {
            successUrl: params.successUrl,
            cancelUrl: params.cancelUrl,
            customerEmail: params.customerEmail,
            customerName: params.customerName,
            metadata: params.metadata || {},
          },
        },
      });

      logger.info(`Payment created: ${payment.id}`, {
        transactionId,
        amount: params.amount,
      });

      return payment as PaymentResponse;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error("Error creating payment", error);
      throw new AppError("Failed to create payment", 500);
    }
  },

  /**
   * Get a payment by ID
   * @param paymentId Payment ID
   * @returns Payment information
   */
  async getPaymentById(paymentId: string): Promise<PaymentResponse> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new AppError("Payment not found", 404);
    }

    return payment as PaymentResponse;
  },

  /**
   * Get a payment by transaction ID
   * @param transactionId Transaction ID
   * @returns Payment information
   */
  async getPaymentByTransactionId(
    transactionId: string
  ): Promise<PaymentResponse> {
    const payment = await prisma.payment.findFirst({
      where: { transactionId },
    });

    if (!payment) {
      throw new AppError("Payment not found", 404);
    }

    return payment as PaymentResponse;
  },

  /**
   * Update payment status
   * @param paymentId Payment ID
   * @param status New payment status
   * @param paymentData Additional payment data
   * @returns Updated payment
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    paymentData?: Record<string, any>
  ): Promise<PaymentResponse> {
    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!existingPayment) {
      throw new AppError("Payment not found", 404);
    }

    // Get booking associated with this payment
    const booking = await prisma.booking.findUnique({
      where: { id: existingPayment.bookingId },
    });

    if (!booking) {
      logger.warn(`Booking not found for payment: ${paymentId}`);
    }

    // Prepare data for update
    const updateData: PaymentUpdateParams = {
      status,
    };

    if (paymentData) {
      // Merge existing payment data with new data
      const existingData = existingPayment.paymentData as Record<string, any> || {};
      updateData.paymentData = {
        ...existingData,
        ...paymentData,
      };
    }

    // Update payment in database
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: updateData,
    });

    logger.info(`Payment status updated: ${paymentId} to ${status}`, {
      bookingId: existingPayment.bookingId,
    });

    return updatedPayment as PaymentResponse;
  },

  /**
   * Process a payment through Paystack
   * @param paymentId Payment ID to process
   * @param email Customer email
   * @returns Transaction initialization data
   */
  async processPaymentWithPaystack(
    paymentId: string,
    email: string
  ): Promise<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }> {
    // Get payment details
    const payment = await this.getPaymentById(paymentId);

    // Get booking details
    const booking = await prisma.booking.findUnique({
      where: { id: payment.bookingId },
    });

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    try {
      // Initialize transaction with Paystack
      const result = await paystack.transaction.initialize({
        amount: payment.amount * 100, // Paystack requires amount in kobo (smallest currency unit)
        email,
        reference: payment.transactionId,
        currency: payment.currency,
        callback_url: (payment.paymentData as Record<string, any>)?.successUrl,
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
      await this.updatePaymentStatus(payment.id, PaymentStatus.PENDING, {
        paystackReference: result.data.reference,
        authorization_url: result.data.authorization_url,
        access_code: result.data.access_code,
      });

      return {
        authorization_url: result.data.authorization_url,
        access_code: result.data.access_code,
        reference: result.data.reference,
      };
    } catch (error) {
      logger.error("Error processing payment with Paystack", error);
      throw new AppError("Failed to process payment", 500);
    }
  },

  /**
   * Verify a payment with Paystack
   * @param reference Paystack reference
   * @returns Verification result
   */
  async verifyPaystackPayment(reference: string): Promise<any> {
    try {
      // Verify transaction with Paystack
      const result = await paystack.transaction.verify({ reference });

      // Find payment with this reference
      const payment = await prisma.payment.findFirst({
        where: {
          paymentData: {
            path: ["paystackReference"],
            equals: reference,
          },
        },
      });

      if (!payment) {
        throw new AppError("Payment not found for reference: " + reference, 404);
      }

      // Update payment based on verification result
      if (result.data.status === "success") {
        await this.updatePaymentStatus(payment.id, PaymentStatus.COMPLETED, {
          verificationData: result.data,
          verifiedAt: new Date().toISOString(),
          processor: "paystack",
          receiptUrl: result.data.receipt_url,
        });

        // Update booking status to CONFIRMED
        await bookingService.updateBookingStatus(
          payment.bookingId,
          "CONFIRMED" as any // Temporary fix for type compatibility
        );

        // Get user email
        const booking = await prisma.booking.findUnique({
          where: { id: payment.bookingId },
          include: { user: true },
        });

        if (booking && booking.user) {
          // Send payment confirmation email
          await emailService.sendPaymentConfirmationEmail(
            booking.user.email,
            booking.bookingReference,
            payment.amount,
            payment.currency
          );
        }
      } else if (
        result.data.status === "failed" ||
        result.data.status === "abandoned"
      ) {
        await this.updatePaymentStatus(payment.id, PaymentStatus.FAILED, {
          verificationData: result.data,
          verifiedAt: new Date().toISOString(),
          processor: "paystack",
          errorMessage: result.data.gateway_response,
        });

        // Update booking status to reflect failed payment
        await bookingService.updateBookingStatus(
          payment.bookingId,
          "PAYMENT_FAILED" as any // Temporary fix for type compatibility
        );
      }

      return result.data;
    } catch (error) {
      logger.error("Error verifying Paystack payment", error);
      throw new AppError("Failed to verify payment", 500);
    }
  },

  /**
   * Process a refund
   * @param paymentId Payment ID to refund
   * @param amount Amount to refund, defaults to full amount
   * @returns Refund result
   */
  async processRefund(
    paymentId: string,
    amount?: number
  ): Promise<PaymentResponse> {
    const payment = await this.getPaymentById(paymentId);

    if (payment.status !== "COMPLETED") {
      throw new AppError("Cannot refund a payment that is not completed", 400);
    }

    // For now, let's simulate a refund since Paystack refund API requires approval
    const refundAmount = amount || payment.amount;

    // Update payment status to REFUNDED
    const updatedPayment = await this.updatePaymentStatus(
      payment.id,
      PaymentStatus.REFUNDED,
      {
        refundedAt: new Date().toISOString(),
        refundedAmount: refundAmount,
        processor: "paystack",
      }
    );

    // Update booking status to REFUNDED
    if (payment.bookingId) {
      await bookingService.updateBookingStatus(
        payment.bookingId,
        "REFUNDED" as any // Temporary fix for type compatibility
      );

      // Get booking details
      const booking = await prisma.booking.findUnique({
        where: { id: payment.bookingId },
        include: { user: true },
      });

      if (booking && booking.user) {
        // Send refund confirmation email
        await emailService.sendRefundConfirmationEmail(
          booking.user.email,
          booking.bookingReference,
          refundAmount,
          payment.currency
        );
      }
    }

    return updatedPayment;
  },

  /**
   * Get payment by booking ID
   * @param bookingId Booking ID
   * @returns Payment
   */
  async getPaymentByBookingId(bookingId: string): Promise<PaymentResponse | null> {
    return (await prisma.payment.findFirst({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
    })) as PaymentResponse | null;
  },

  /**
   * Get all user payments
   * @param userId User ID
   * @returns List of payments
   */
  async getUserPayments(userId: string): Promise<PaymentResponse[]> {
    return (await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })) as PaymentResponse[];
  },

  /**
   * Get payment methods for a user
   * @param userId User ID
   * @returns Payment methods
   */
  async getPaymentMethods(userId: string): Promise<PaymentResponse[]> {
    return (await prisma.payment.findMany({
      where: { 
        userId,
        status: PaymentStatus.COMPLETED,
      },
      distinct: ["paymentMethod"],
      orderBy: { createdAt: "desc" },
    })) as PaymentResponse[];
  },
};
