export declare const emailService: {
    /**
     * Send an email
     * @param to Recipient email
     * @param subject Email subject
     * @param html Email HTML content
     * @param text Email text content
     */
    sendEmail(to: string, subject: string, html: string, text?: string): Promise<void>;
    /**
     * Send booking confirmation email
     * @param to Recipient email
     * @param bookingReference Booking reference
     * @param flightOfferData Flight offer data
     * @param passengerDetails Passenger details
     * @param totalAmount Total amount
     * @param currency Currency
     */
    sendBookingConfirmationEmail(to: string, bookingReference: string, flightOfferData: any, passengerDetails: any[], totalAmount: number, currency: string): Promise<void>;
    /**
     * Send booking cancellation email
     * @param to Recipient email
     * @param bookingReference Booking reference
     */
    sendBookingCancellationEmail(to: string, bookingReference: string): Promise<void>;
    /**
     * Send OTP verification email
     * @param to Recipient email
     * @param otp One-time password
     * @param name Recipient name
     */
    sendOTPEmail(to: string, otp: string, name: string): Promise<void>;
    /**
     * Send OTP verification email for guest account creation
     * @param to Recipient email
     * @param otp One-time password
     */
    sendGuestOTPEmail(to: string, otp: string): Promise<void>;
    /**
     * Send OTP verification email for registration
     * @param to Recipient email
     * @param otp One-time password
     */
    sendRegistrationOTPEmail(to: string, otp: string): Promise<void>;
    /**
     * Send welcome email to guest users
     * @param to Recipient email
     * @param name Recipient first name
     */
    sendGuestWelcomeEmail(to: string, name: string): Promise<void>;
    /**
     * Send flight booking confirmation email
     * @param email Recipient email
     * @param name Recipient name
     * @param bookingReference Booking reference
     * @param flightOffer Flight offer
     */
    sendFlightBookingConfirmation(email: string, name: string, bookingReference: string, flightOffer: any): Promise<void>;
    /**
     * Send payment confirmation email
     * @param to Recipient email address
     * @param bookingReference Booking reference
     * @param amount Payment amount
     * @param currency Currency code
     * @returns Promise resolving when email is sent
     */
    sendPaymentConfirmationEmail(to: string, bookingReference: string, amount: number, currency: string): Promise<void>;
    /**
     * Send refund confirmation email
     * @param to Recipient email address
     * @param bookingReference Booking reference
     * @param amount Refund amount
     * @param currency Currency code
     * @returns Promise resolving when email is sent
     */
    sendRefundConfirmationEmail(to: string, bookingReference: string, amount: number, currency: string): Promise<void>;
};
//# sourceMappingURL=email.service.d.ts.map