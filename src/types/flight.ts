export interface Location {
  type: string;
  subType: string;
  name: string;
  detailedName: string;
  id: string;
  timeZoneOffset: string;
  iataCode: string;
  geoCode: {
    latitude: number;
    longitude: number;
  };
  address: {
    cityName: string;
    cityCode: string;
    countryName: string;
    countryCode: string;
    regionCode: string;
  };
  self?: {
    href: string;
    methods: string[];
  };
}

export interface FlightOfferExtras {
  originLocationCode?: string;
  destinationLocationCode?: string;
  departureDate?: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  infants?: number;
  travelClass?: string;
  nonStop?: boolean;
  currencyCode?: string;
  maxPrice?: number;
}

export interface FlightOffer extends FlightOfferExtras {
  type: string;
  id: string;
  source: string;
  instantTicketingRequired: boolean;
  nonHomogeneous: boolean;
  oneWay: boolean;
  lastTicketingDate: string;
  numberOfBookableSeats: number;
  itineraries: Itinerary[];
  price: {
    currency: string;
    total: string;
    base: string;
    fees: Fee[];
    grandTotal: string;
  };
  pricingOptions: {
    fareType: string[];
    includedCheckedBagsOnly: boolean;
  };
  validatingAirlineCodes: string[];
  travelerPricings: TravelerPricing[];
  preferences?: {
    maxConnections?: number;
    nonStop?: boolean;
  };
}

export interface Itinerary {
  duration: string;
  segments: Segment[];
}

export interface Segment {
  departure: {
    iataCode: string;
    terminal?: string;
    at: string;
  };
  arrival: {
    iataCode: string;
    terminal?: string;
    at: string;
  };
  carrierCode: string;
  number: string;
  aircraft: {
    code: string;
  };
  operating?: {
    carrierCode: string;
  };
  duration: string;
  id: string;
  numberOfStops: number;
  blacklistedInEU: boolean;
}

export interface Fee {
  amount: string;
  type: string;
}

export interface TravelerPricing {
  travelerId: string;
  fareOption: string;
  travelerType: string;
  price: {
    currency: string;
    total: string;
    base: string;
  };
  fareDetailsBySegment: FareDetailsBySegment[];
}

export interface FareDetailsBySegment {
  segmentId: string;
  cabin: string;
  fareBasis: string;
  class: string;
  includedCheckedBags: {
    quantity: number;
  };
}

export interface FlightOrder {
  type: string;
  id: string;
  queuingOfficeId: string;
  associatedRecords: {
    reference: string;
    creationDate: string;
    originSystemCode: string;
    flightOfferId: string;
  }[];
  flightOffers: FlightOffer[];
  travelers: Traveler[];
  contacts: Contact[];
  preferences?: {
    maxConnections?: number;
    nonStop?: boolean;
  };
  data?: any;
}

export interface Traveler {
  id: string;
  dateOfBirth: string;
  name: {
    firstName: string;
    lastName: string;
  };
  gender: string;
  contact: {
    emailAddress: string;
    phones: {
      deviceType: string;
      countryCallingCode?: string;
      number: string;
    }[];
  };
  documents: {
    documentType: string;
    birthPlace?: string;
    issuanceLocation?: string;
    issuanceDate?: string;
    number: string;
    expiryDate: string;
    issuanceCountry: string;
    validityCountry?: string;
    nationality: string;
    holder?: boolean;
  }[];
}

export interface Contact {
  addresseeName: {
    firstName: string;
    lastName: string;
  };
  companyName?: string;
  purpose: string;
  phones: {
    deviceType: string;
    countryCallingCode?: string;
    number: string;
  }[];
  emailAddress: string;
  address: {
    lines: string[];
    postalCode: string;
    cityName: string;
    countryCode: string;
  };
}

export interface AmadeusResponse<T> {
  data: T;
  meta?: {
    count?: number;
    links?: {
      self?: string;
    };
  };
}

export interface FlightOrderRequest {
  type: string;
  flightOffers: FlightOffer[];
  travelers: Traveler[];
  contacts: Contact[];
  preferences?: {
    maxConnections?: number;
    nonStop?: boolean;
  };
  data?: any;
}

export interface FlightDatesResponse {
  data: Array<{
    type: string;
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    price: {
      total: string;
      currency: string;
    };
  }>;
}

export interface FlightAvailabilityResponse {
  data: Array<{
    type: string;
    id: string;
    originDestination: {
      id: string;
      originLocationCode: string;
      destinationLocationCode: string;
      departureDateTime: string;
    };
    segments: Array<{
      id: string;
      numberOfStops: number;
      blacklistedInEU: boolean;
      departure: {
        iataCode: string;
        terminal?: string;
        at: string;
      };
      arrival: {
        iataCode: string;
        terminal?: string;
        at: string;
      };
      carrierCode: string;
      number: string;
      aircraft: {
        code: string;
      };
      availabilityClasses: Array<{
        numberOfBookableSeats: number;
        class: string;
      }>;
    }>;
  }>;
} 