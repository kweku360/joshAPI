declare module 'amadeus' {
  export interface AmadeusOptions {
    clientId: string;
    clientSecret: string;
    environment?: string;
    logLevel?: string;
  }

  export interface AmadeusError {
    code: string;
    title: string;
    detail: string;
    source?: Record<string, any>;
    documentation?: string;
  }

  export interface AmadeusResponse {
    data: any;
    result: {
      status: number;
      statusText: string;
      request: {
        method: string;
        path: string;
        params: Record<string, any>;
      };
    };
  }

  export interface AmadeusSearchParams {
    originLocationCode: string;
    destinationLocationCode: string;
    departureDate: string;
    returnDate?: string;
    adults: number;
    children?: number;
    infants?: number;
    travelClass?: string;
    currencyCode?: string;
    maxPrice?: number;
    max?: number;
    includedAirlineCodes?: string;
    excludedAirlineCodes?: string;
    nonStop?: boolean;
  }

  export default class Amadeus {
    constructor(options: AmadeusOptions);

    shopping: {
      flightOffersSearch: {
        get(params: Record<string, any>): Promise<AmadeusResponse>;
      };
      flightOffers: {
        pricing: {
          post(body: string): Promise<AmadeusResponse>;
        };
      };
    };

    booking: {
      flightOrders: {
        post(body: string): Promise<AmadeusResponse>;
      };
    };

    referenceData: {
      locations: {
        get(params: Record<string, any>): Promise<AmadeusResponse>;
      };
    };
  }
}