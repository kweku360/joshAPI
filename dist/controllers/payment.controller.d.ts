import { Request, Response, NextFunction } from "express";
export declare const paymentController: {
    /**
     * Initialize a payment
     * @route POST /api/payments/initialize
     */
    initializePayment(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Verify a payment
     * @route GET /api/payments/verify/:reference
     */
    verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Handle Paystack webhook
     * @route POST /api/payments/webhook
     */
    handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Handle successful payment event
     * @param data Payment data from webhook
     */
    handleSuccessfulPayment(data: any): Promise<void>;
    /**
     * Handle successful transfer event
     * @param data Transfer data from webhook
     */
    handleSuccessfulTransfer(data: any): Promise<void>;
    /**
     * Handle failed payment event
     * @param data Failed payment data from webhook
     */
    handleFailedPayment(data: any): Promise<void>;
    /**
     * Handle refund event
     * @param data Refund data from webhook
     */
    handleRefund(data: any): Promise<void>;
    /**
     * Get user's payment history
     * @route GET /api/payments/history
     */
    getPaymentHistory(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get payment details
     * @route GET /api/payments/:paymentId
     */
    getPaymentDetails(req: Request, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=payment.controller.d.ts.map