import { Request, Response, NextFunction } from "express";
export declare const bookingController: {
    /**
     * Create a new booking
     */
    createBooking(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get a booking by ID
     */
    getBooking(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get a booking by reference number
     */
    getBookingByReference(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get all bookings for the current user
     */
    getUserBookings(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Cancel a booking
     */
    cancelBooking(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Generate an e-ticket for a confirmed booking
     */
    generateETicket(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Confirm a booking with Amadeus (admin or system use)
     */
    confirmBookingWithAmadeus(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Create a flight booking
     * @route POST /api/bookings/flights
     * @access Private
     */
    createFlightBooking(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get user's flight bookings
     * @route GET /api/bookings/flights
     * @access Private
     */
    getUserFlightBookings(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get flight booking details
     * @route GET /api/bookings/flights/:id
     * @access Private
     */
    getFlightBookingDetails(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
};
//# sourceMappingURL=booking.controller.d.ts.map