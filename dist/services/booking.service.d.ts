import type { Booking } from "../types/booking";
import { BookingStatus } from "../types/enums";
export declare const bookingService: {
    /**
     * Update booking with Amadeus order information
     * @param bookingId The booking ID
     * @param amadeusOrderId Amadeus order ID
     * @param amadeusOrderData Amadeus order data
     * @returns Updated booking
     */
    updateBookingWithAmadeusOrder(bookingId: string, amadeusOrderId: string, amadeusOrderData: any): Promise<Booking>;
    /**
     * Update booking with guest user ID after guest account creation
     * @param bookingId The booking ID
     * @param userId The user ID to associate
     * @returns Updated booking
     */
    updateBookingUser(bookingId: string, userId: string): Promise<Booking>;
    /**
     * Create a new booking
     */
    createBooking(userId: string | null, flightOfferId: string, flightOfferData: any, passengerDetails: any[], totalAmount: number, currency?: string): Promise<Booking>;
    /**
     * Get a booking by ID
     */
    getBookingById(bookingId: string): Promise<Booking>;
    /**
     * Get a booking by reference
     */
    getBookingByReference(bookingReference: string): Promise<Booking>;
    /**
     * Get all bookings for a user
     */
    getUserBookings(userId: string): Promise<Booking[]>;
    /**
     * Update booking status
     */
    updateBookingStatus(bookingId: string, status: BookingStatus): Promise<Booking>;
    /**
     * Cancel a booking
     */
    cancelBooking(bookingId: string): Promise<Booking>;
    /**
     * Generate e-ticket for a booking
     */
    generateETicket(bookingId: string): Promise<string>;
    /**
     * Create a flight booking
     * @param userId User ID
     * @param flightOffer Flight offer
     * @param travelers Traveler information
     * @param contact Contact information
     * @returns Booking information
     */
    createFlightBooking(userId: string, flightOffer: any, travelers: any[], contact: any): Promise<any>;
    /**
     * Get user's flight bookings
     * @param userId User ID
     * @returns List of bookings
     */
    getUserFlightBookings(userId: string): Promise<any[]>;
    /**
     * Get flight booking details
     * @param bookingId Booking ID
     * @param userId User ID
     * @returns Booking details
     */
    getFlightBookingDetails(bookingId: string, userId: string): Promise<any>;
    /**
     * Confirm booking with Amadeus
     */
    confirmBookingWithAmadeus(bookingId: string): Promise<Booking>;
    /**
     * Clear booking cache - useful for testing
     */
    clearCache(): void;
};
//# sourceMappingURL=booking.service.d.ts.map