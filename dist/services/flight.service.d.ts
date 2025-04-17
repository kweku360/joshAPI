import { Location, FlightOffer, FlightOrder, Traveler, Contact, FlightDatesResponse, FlightAvailabilityResponse } from '../types/flight';
export declare const flightService: {
    /**
     * Search for airports and cities
     * @param keyword Search keyword
     * @returns List of airports and cities
     */
    searchLocations(keyword: string): Promise<Location[]>;
    /**
     * Search for flight offers
     * @param origin Origin location code
     * @param destination Destination location code
     * @param departureDate Departure date
     * @param returnDate Optional return date
     * @param adults Number of adult passengers
     * @param children Number of child passengers
     * @param infants Number of infant passengers
     * @param travelClass Travel class
     * @param maxResults Maximum number of results
     * @param currencyCode Currency code
     * @returns Flight offers
     */
    searchFlightOffers(origin: string, destination: string, departureDate: string, returnDate?: string, adults?: number, children?: number, infants?: number, travelClass?: string, maxResults?: number, currencyCode?: string): Promise<FlightOffer[]>;
    /**
     * Search for multi-city flight offers
     */
    searchMultiCityFlightOffers(originDestinations: Array<{
        id?: string;
        originLocationCode: string;
        destinationLocationCode: string;
        departureDate?: string;
        departureDateTimeRange?: {
            date: string;
        };
    }>, adults?: number, children?: number, infants?: number, travelClass?: string, currencyCode?: string): Promise<any>;
    /**
     * Price flight offers
     * @param flightOffers Flight offers to price
     * @returns Pricing information
     */
    priceFlightOffers(params: {
        flightOffers: any;
        currencyCode?: string;
    }): Promise<any>;
    /**
     * Search for flight dates by specific date
     */
    searchFlightDatesByDate(origin: string, destination: string, departureDate: string, currencyCode?: string): Promise<FlightDatesResponse>;
    /**
     * Search for flight dates using a duration
     */
    searchFlightDatesByDuration(origin: string, destination: string, duration: number, currencyCode?: string): Promise<FlightDatesResponse>;
    /**
     * Search for flight availabilities
     */
    searchFlightAvailabilities(originDestinations: Array<{
        id: string;
        originLocationCode: string;
        destinationLocationCode: string;
        departureDateTime: {
            date: string;
            time?: string;
        };
    }>, travelers: Array<{
        id: string;
        travelerType: string;
    }>, sources?: string[]): Promise<FlightAvailabilityResponse>;
    /**
     * Create flight booking
     * @param flightOffer Flight offer to book
     * @param travelers Traveler information
     * @param contact Contact information
     * @returns Booking information
     */
    createFlightBooking(flightOffer: FlightOffer, travelers: Traveler[], contact: Contact): Promise<FlightOrder>;
};
//# sourceMappingURL=flight.service.d.ts.map