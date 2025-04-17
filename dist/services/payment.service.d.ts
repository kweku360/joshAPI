import { PaymentCreateParams, PaymentResponse } from "../types/payment";
import { PaymentStatus } from "../types/enums";
/**
 * Payment service with Paystack integration
 */
export declare const paymentService: {
    /**
     * Create a new payment
     * @param params Payment creation parameters
     * @returns Created payment
     */
    createPayment(params: PaymentCreateParams): Promise<PaymentResponse>;
    /**
     * Get a payment by ID
     * @param paymentId Payment ID
     * @returns Payment information
     */
    getPaymentById(paymentId: string): Promise<PaymentResponse>;
    /**
     * Get a payment by transaction ID
     * @param transactionId Transaction ID
     * @returns Payment information
     */
    getPaymentByTransactionId(transactionId: string): Promise<PaymentResponse>;
    /**
     * Update payment status
     * @param paymentId Payment ID
     * @param status New payment status
     * @param paymentData Additional payment data
     * @returns Updated payment
     */
    updatePaymentStatus(paymentId: string, status: PaymentStatus, paymentData?: Record<string, any>): Promise<PaymentResponse>;
    /**
     * Process a payment through Paystack
     * @param paymentId Payment ID to process
     * @param email Customer email
     * @returns Transaction initialization data
     */
    processPaymentWithPaystack(paymentId: string, email: string): Promise<{
        authorization_url: string;
        access_code: string;
        reference: string;
    }>;
    /**
     * Verify a payment with Paystack
     * @param reference Paystack reference
     * @returns Verification result
     */
    verifyPaystackPayment(reference: string): Promise<any>;
    /**
     * Process a refund
     * @param paymentId Payment ID to refund
     * @param amount Amount to refund, defaults to full amount
     * @returns Refund result
     */
    processRefund(paymentId: string, amount?: number): Promise<PaymentResponse>;
    /**
     * Get payment by booking ID
     * @param bookingId Booking ID
     * @returns Payment
     */
    getPaymentByBookingId(bookingId: string): Promise<PaymentResponse | null>;
    /**
     * Get all user payments
     * @param userId User ID
     * @returns List of payments
     */
    getUserPayments(userId: string): Promise<PaymentResponse[]>;
    /**
     * Get payment methods for a user
     * @param userId User ID
     * @returns Payment methods
     */
    getPaymentMethods(userId: string): Promise<PaymentResponse[]>;
};
//# sourceMappingURL=payment.service.d.ts.map