import { PaymentStatus } from './enums';
export interface PaymentData {
    reference: string;
    processor: string;
    transactionId: string;
    amount: number;
    currency: string;
    fees?: number;
    metadata?: Record<string, any>;
    customerReference?: string;
    status: string;
    paymentMethod: string;
    verificationUrl?: string;
    receiptUrl?: string;
    errorMessage?: string;
    errorCode?: string;
    successUrl?: string;
    cancelUrl?: string;
    [key: string]: any;
}
export interface PaymentCreateParams {
    bookingId: string;
    userId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    successUrl?: string;
    cancelUrl?: string;
    customerEmail?: string;
    customerName?: string;
    metadata?: Record<string, any>;
}
export interface PaymentUpdateParams {
    transactionId?: string;
    status?: PaymentStatus;
    paymentData?: PaymentData | Record<string, any>;
}
export interface PaymentResponse {
    id: string;
    bookingId: string;
    userId: string;
    transactionId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    status: PaymentStatus;
    paymentData?: PaymentData | Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface PaymentVerificationParams {
    transactionId: string;
    reference?: string;
}
//# sourceMappingURL=payment.d.ts.map