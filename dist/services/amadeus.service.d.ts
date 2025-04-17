import { FlightSearchParams, FlightOffer, Location } from "../types";
export declare const amadeusService: {
    /**
     * Search for flights based on given parameters
     */
    searchFlights(params: FlightSearchParams): Promise<FlightOffer[]>;
    /**
     * Get pricing for flight offers
     */
    getFlightPrice(flightOffers: FlightOffer[]): Promise<any>;
    /**
     * Create flight booking order
     */
    createFlightOrder(flightOffer: FlightOffer, travelers: any[]): Promise<any>;
    /**
     * Search for airports by keyword
     */
    searchAirports(keyword: string): Promise<any[]>;
    /**
     * Search for locations (cities and airports) by keyword
     * @param keyword Search keyword
     * @param countryCode Optional country code to filter results
     * @returns Array of location objects with detailed information
     */
    searchLocations(keyword: string, countryCode?: string): Promise<Location[]>;
    /**
     * Clear all caches - useful for testing or manual cache invalidation
     */
    clearCaches(): void;
    /**
     * Search for cheapest flight dates for flexible travelers
     * @param origin Origin airport code
     * @param destination Destination airport code
     * @param departureDate Base departure date (YYYY-MM-DD) or null if using duration
     * @param currencyCode Currency code (optional)
     * @param duration Number of days to search from today (optional, used if departureDate is null)
     * @returns Array of flight dates with prices
     */
    searchCheapestFlightDates(origin: string, destination: string, departureDate: string, currencyCode?: string): Promise<any>;
    /**
     * Analyze flight price to determine if it's a good deal
     * @param originIataCode Origin airport code
     * @param destinationIataCode Destination airport code
     * @param departureDate Departure date
     * @param returnDate Return date (optional)
     * @param oneWay Whether this is a one-way flight
     * @param currencyCode Currency code
     * @returns Price analysis information
     */
    analyzeFlightPrice(originIataCode: string, destinationIataCode: string, departureDate: string, returnDate?: string, oneWay?: boolean, currencyCode?: string): Promise<any>;
    /**
     * Evaluate if a price is a good deal based on price metrics
     * @param priceMetrics Price metrics from Amadeus
     * @param currentPrice Current price to evaluate
     * @returns Deal evaluation
     */
    evaluateDeal(priceMetrics: any, currentPrice: number): any;
    /**
     * Provide fallback analysis when the API call fails
     * @param currentPrice Current price
     * @returns Basic deal evaluation
     */
    provideFallbackAnalysis(currentPrice: number): any;
    /**
     * Get human-readable summary of deal rating
     * @param dealRating Deal rating
     * @returns Human-readable summary
     */
    getDealSummary(dealRating: string): string;
};
//# sourceMappingURL=amadeus.service.d.ts.map