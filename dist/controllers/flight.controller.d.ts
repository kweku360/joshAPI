import { Request, Response, NextFunction } from "express";
export declare const flightController: {
    /**
     * Search for flights based on criteria
     */
    searchFlights(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
    /**
     * Search for locations (airports and cities) by keyword
     * @route GET /api/flights/locations
     * @access Public
     * @example GET /api/flights/locations?keyword=MUC&countryCode=DE
     */
    searchLocations(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get pricing for selected flight offers
     */
    getFlightPrice(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Search for airports and cities by keyword
     */
    searchAirports(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Verify a flight offer is still valid and get updated pricing
     */
    verifyFlightOffer(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Book a flight with provided passenger details
     * Handles both guest and authenticated users
     */
    bookFlight(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * Search for cheapest flight dates for flexible travelers
     * @route GET /api/flights/dates
     * @access Public
     */
    searchFlightDates(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Search for flight offers with multi-criteria
     * @route POST /api/flights/advanced-search
     * @access Public
     */
    advancedFlightSearch(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Price flight offer
     * @route POST /api/flights/price
     * @access Public
     */
    priceFlightOffer(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Create flight booking
     * @route POST /api/flights/booking
     * @access Private
     */
    createBooking(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * Analyze flight price to determine if it's a good deal
     * @route GET /api/flights/analyze-price
     * @access Public
     */
    analyzeFlightPrice(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Search for flight availabilities with detailed seat information
     * @route POST /api/flights/availabilities
     * @access Public
     */
    searchFlightAvailabilities(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
};
//# sourceMappingURL=flight.controller.d.ts.map