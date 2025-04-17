import { BookingStatus } from "./enums";
export interface PassengerDetail {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    documentType: string;
    documentNumber: string;
    documentExpiryDate: string;
    documentIssuingCountry: string;
    nationality: string;
    email?: string;
    phone?: string;
}
export interface BookingCreateParams {
    userId: string | null;
    flightOfferId: string;
    flightOfferData: any;
    passengerDetails: PassengerDetail[];
    totalAmount: number;
    currency?: string;
}
export interface FlightOffer {
    id: string;
    type: string;
    source: string;
    instantTicketingRequired: boolean;
    nonHomogeneous: boolean;
    oneWay: boolean;
    lastTicketingDate: string;
    numberOfBookableSeats: number;
    itineraries: any[];
    price: {
        currency: string;
        total: string;
        base: string;
        fees: any[];
        grandTotal: string;
    };
    pricingOptions: {
        fareType: string[];
        includedCheckedBagsOnly: boolean;
    };
    validatingAirlineCodes: string[];
    travelerPricings: any[];
}
export interface Booking {
    id: string;
    bookingReference: string;
    userId: string | null;
    flightOfferData: any;
    passengerDetails: PassengerDetail[];
    status: BookingStatus;
    failureReason?: string;
    amadeusOrderId?: string;
    amadeusOrderData?: any;
    contactEmail: string;
    contactPhone?: string;
    totalAmount: number;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date;
    eTicketUrl?: string;
}
export declare function asPrismaBooking(booking: any): Booking;
//# sourceMappingURL=booking.d.ts.map