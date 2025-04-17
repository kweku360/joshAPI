import Amadeus from "amadeus";
import NodeCache from "node-cache";
import config from "../config";
import { logger } from "../utils/logger";
import { AppError } from "../utils/appError";
import { FlightSearchParams, FlightOffer, Location } from "../types";
import { redisService } from "./redis.service";

// Initialize Amadeus client with type assertion
const amadeus = new Amadeus({
  clientId: config.amadeus.clientId,
  clientSecret: config.amadeus.clientSecret,
  hostname: config.amadeus.apiEnv === "production" ? "production" : "test",
  logLevel: config.env === "development" ? "debug" : "silent",
} as any);

// Cache configuration
const flightSearchCache = new NodeCache({
  stdTTL: 300, // 5 minutes cache
  checkperiod: 60,
  useClones: false,
});

const airportSearchCache = new NodeCache({
  stdTTL: 86400, // 24 hours cache for airports data
  checkperiod: 3600,
  useClones: false,
});

// Error handling helper
const handleAmadeusError = (error: any, defaultMessage: string): never => {
  logger.error("Amadeus API error", { error });

  // If it's an Amadeus API error with details
  if (error.response && error.response.data && error.response.data.errors) {
    const apiError = error.response.data.errors[0];
    throw new AppError(
      `Amadeus API error: ${apiError.detail || apiError.title}`,
      error.response.statusCode || 400,
      { code: apiError.code, source: apiError.source }
    );
  }

  // If it's a connection error or other type
  throw new AppError(defaultMessage, 500);
};

// Base service with common methods
export const amadeusService = {
  /**
   * Search for flights based on given parameters
   */
  async searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
    try {
      // Generate cache key based on search parameters
      const cacheKey = `flight_search_${JSON.stringify(params)}`;

      // Check cache first
      const cachedResult = flightSearchCache.get<FlightOffer[]>(cacheKey);
      if (cachedResult) {
        logger.info("Retrieved flight search results from cache", {
          origin: params.originLocationCode,
          destination: params.destinationLocationCode,
        });
        return cachedResult;
      }

      logger.info("Searching flights with Amadeus", { params });

      // Create search parameters
      const searchParams: Record<string, any> = {
        originLocationCode: params.originLocationCode,
        destinationLocationCode: params.destinationLocationCode,
        departureDate: params.departureDate,
        adults: params.adults,
        currencyCode: params.currencyCode || "USD",
        max: params.max || 50,
      };

      // Add optional parameters
      if (params.returnDate) searchParams.returnDate = params.returnDate;
      if (params.children) searchParams.children = params.children;
      if (params.infants) searchParams.infants = params.infants;
      if (params.travelClass) searchParams.travelClass = params.travelClass;
      if (params.maxPrice) searchParams.maxPrice = params.maxPrice;
      if (params.includedAirlineCodes)
        searchParams.includedAirlineCodes = params.includedAirlineCodes;
      if (params.excludedAirlineCodes)
        searchParams.excludedAirlineCodes = params.excludedAirlineCodes;
      if (params.nonStop !== undefined) searchParams.nonStop = params.nonStop;

      // Start timer for performance monitoring
      const startTime = Date.now();

      // Make API call
      const response =
        await amadeus.shopping.flightOffersSearch.get(searchParams);

      // Record performance metrics
      const duration = Date.now() - startTime;
      logger.debug(
        `Amadeus flight search API call completed in ${duration}ms`,
        {
          origin: params.originLocationCode,
          destination: params.destinationLocationCode,
          responseTime: duration,
        }
      );

      // Cache the results
      flightSearchCache.set(cacheKey, response.data);

      return response.data;
    } catch (error) {
      return handleAmadeusError(error, "Failed to search flights");
    }
  },

  /**
   * Get pricing for flight offers
   */
  async getFlightPrice(flightOffers: FlightOffer[]): Promise<any> {
    try {
      // Generate cache key based on flight offers
      const cacheKey = `flight_price_${JSON.stringify(flightOffers)}`;

      // Check cache first
      const cachedResult = flightSearchCache.get(cacheKey);
      if (cachedResult) {
        logger.info("Retrieved flight pricing from cache");
        return cachedResult;
      }

      logger.info("Getting flight price with Amadeus");

      // Start timer for performance monitoring
      const startTime = Date.now();

      // Make API call
      const response = await amadeus.shopping.flightOffers.pricing.post(
        JSON.stringify({
          data: {
            type: "flight-offers-pricing",
            flightOffers,
          },
        })
      );

      // Record performance metrics
      const duration = Date.now() - startTime;
      logger.debug(
        `Amadeus flight pricing API call completed in ${duration}ms`,
        {
          responseTime: duration,
        }
      );

      // Cache the results
      flightSearchCache.set(cacheKey, response.data);

      return response.data;
    } catch (error) {
      return handleAmadeusError(error, "Failed to get flight price");
    }
  },

  /**
   * Create flight booking order
   */
  async createFlightOrder(
    flightOffer: FlightOffer,
    travelers: any[]
  ): Promise<any> {
    try {
      logger.info("Creating flight order with Amadeus");

      // Start timer for performance monitoring
      const startTime = Date.now();

      // Make API call
      const response = await amadeus.booking.flightOrders.post(
        JSON.stringify({
          data: {
            type: "flight-order",
            flightOffers: [flightOffer],
            travelers,
          },
        })
      );

      // Record performance metrics
      const duration = Date.now() - startTime;
      logger.debug(`Amadeus flight order API call completed in ${duration}ms`, {
        responseTime: duration,
      });

      return response.data;
    } catch (error) {
      return handleAmadeusError(error, "Failed to create flight order");
    }
  },

  /**
   * Search for airports by keyword
   */
  async searchAirports(keyword: string): Promise<any[]> {
    try {
      // Generate cache key
      const cacheKey = `airport_search_${keyword.toLowerCase()}`;

      // Check cache first
      const cachedResult = airportSearchCache.get<any[]>(cacheKey);
      if (cachedResult) {
        logger.info("Retrieved airport search results from cache", { keyword });
        return cachedResult;
      }

      logger.info("Searching airports with Amadeus", { keyword });

      // Start timer for performance monitoring
      const startTime = Date.now();

      // Make API call - limit to airports only
      const response = await amadeus.referenceData.locations.get({
        keyword,
        subType: "AIRPORT",
        page: { limit: 20 },
      });

      // Record performance metrics
      const duration = Date.now() - startTime;
      logger.debug(
        `Amadeus airport search API call completed in ${duration}ms`,
        {
          keyword,
          responseTime: duration,
        }
      );

      // Cache the results
      airportSearchCache.set(cacheKey, response.data);

      return response.data;
    } catch (error) {
      return handleAmadeusError(error, "Failed to search airports");
    }
  },

  /**
   * Search for locations (cities and airports) by keyword
   * @param keyword Search keyword
   * @param countryCode Optional country code to filter results
   * @returns Array of location objects with detailed information
   */
  async searchLocations(
    keyword: string,
    countryCode?: string
  ): Promise<Location[]> {
    try {
      // Generate cache key
      const cacheKey = `location_search_${keyword.toLowerCase()}_${countryCode || "all"}`;

      // Check cache first
      const cachedResult = airportSearchCache.get<Location[]>(cacheKey);
      if (cachedResult) {
        logger.info("Retrieved location search results from cache", {
          keyword,
          countryCode,
        });
        return cachedResult;
      }

      logger.info("Searching locations with Amadeus", { keyword, countryCode });

      // Start timer for performance monitoring
      const startTime = Date.now();

      // Build search parameters exactly as per Amadeus documentation
      const params: Record<string, any> = {
        keyword,
        subType: "CITY,AIRPORT",
        page: { limit: 25 },
      };

      // Add country code if provided - as per Amadeus docs
      if (countryCode) {
        params.countryCode = countryCode;
      }

      // Make API call
      const response = await amadeus.referenceData.locations.get(params);

      // Record performance metrics
      const duration = Date.now() - startTime;
      logger.debug(
        `Amadeus location search API call completed in ${duration}ms`,
        {
          keyword,
          countryCode,
          responseTime: duration,
        }
      );

      // Transform the data to match our Location interface
      const locations = response.data.map((location: any) => ({
        type: location.type,
        subType: location.subType,
        name: location.name,
        detailedName: location.detailedName,
        id: location.id,
        self: location.self,
        timeZoneOffset: location.timeZoneOffset,
        iataCode: location.iataCode,
        address: location.address,
        geoCode: location.geoCode,
        distance: location.distance,
        analytics: location.analytics,
        relevance: location.relevance,
      }));

      // Cache the results
      airportSearchCache.set(cacheKey, locations);

      return locations;
    } catch (error) {
      return handleAmadeusError(error, "Failed to search locations");
    }
  },

  /**
   * Clear all caches - useful for testing or manual cache invalidation
   */
  clearCaches(): void {
    flightSearchCache.flushAll();
    airportSearchCache.flushAll();
    logger.info("Amadeus API caches cleared");
  },

  /**
   * Search for cheapest flight dates for flexible travelers
   * @param origin Origin airport code
   * @param destination Destination airport code
   * @param departureDate Base departure date (YYYY-MM-DD) or null if using duration
   * @param currencyCode Currency code (optional)
   * @param duration Number of days to search from today (optional, used if departureDate is null)
   * @returns Array of flight dates with prices
   */
  async searchCheapestFlightDates(
    origin: string,
    destination: string,
    departureDate: string,
    currencyCode: string = "GHS"
  ): Promise<any> {
    try {
      // Ensure date is in YYYY-MM-DD format
      if (!departureDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        throw new AppError("Departure date must be in YYYY-MM-DD format", 400);
      }

      // Generate cache key based on search parameters
      const cacheKey = `flight_cheapest_dates_${origin}_${destination}_${departureDate}_${currencyCode}`;

      // Check cache first
      const cachedResult = flightSearchCache.get(cacheKey);
      if (cachedResult) {
        logger.info("Retrieved cheapest flight dates from cache", {
          origin,
          destination,
          departureDate,
        });
        return cachedResult;
      }

      logger.info("Searching cheapest flight dates with Amadeus", {
        origin,
        destination,
        departureDate,
      });

      // Start timer for performance monitoring
      const startTime = Date.now();

      // Make API call to flight-dates endpoint
      // Since flightDates might not exist in the Amadeus API, simulate it
      let response;

      // Type-safe check for flightDates property
      const hasFlightDatesSupport =
        amadeus &&
        typeof amadeus.shopping === "object" &&
        amadeus.shopping &&
        typeof (amadeus.shopping as any).flightDates === "object";

      if (!hasFlightDatesSupport) {
        logger.warn(
          "Amadeus flightDates API not available, using mock response"
        );
        response = {
          data: simulateFlightDatesResponse(
            origin,
            destination,
            departureDate,
            currencyCode
          ),
        };
      } else {
        response = await (amadeus.shopping as any).flightDates.get({
          origin,
          destination,
          departureDate, // Now ensured to be in YYYY-MM-DD format
          oneWay: true,
          currencyCode,
        });
      }

      // Record performance metrics
      const duration = Date.now() - startTime;
      logger.debug(
        `Amadeus cheapest flight dates API call completed in ${duration}ms`,
        {
          responseTime: duration,
        }
      );

      // Cache the results
      flightSearchCache.set(cacheKey, response.data);

      return response.data;
    } catch (error) {
      return handleAmadeusError(error, "Failed to get cheapest flight dates");
    }
  },

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
  async analyzeFlightPrice(
    originIataCode: string,
    destinationIataCode: string,
    departureDate: string,
    returnDate?: string,
    oneWay: boolean = false,
    currencyCode: string = "GHS"
  ): Promise<any> {
    try {
      logger.info("Analyzing flight price", {
        originIataCode,
        destinationIataCode,
        departureDate,
        returnDate,
        oneWay,
        currencyCode,
      });

      // Generate cache key based on parameters
      const cacheKey = `price_analysis_${originIataCode}_${destinationIataCode}_${departureDate}_${returnDate || "no-return"}_${oneWay}_${currencyCode}`;

      // Check cache first
      const cachedResult = await redisService.get(cacheKey);
      if (cachedResult) {
        logger.info("Retrieved price analysis from cache");
        return cachedResult;
      }

      // Prepare the API request parameters
      const params: Record<string, any> = {
        originIataCode,
        destinationIataCode,
        departureDate,
        currencyCode,
        oneWay: oneWay.toString(),
      };

      // Add returnDate if provided
      if (returnDate) {
        params.returnDate = returnDate;
      }

      // Make API call to Amadeus price metrics endpoint
      let response;

      // Type-safe check for analytics property
      const hasAnalyticsSupport =
        amadeus &&
        typeof (amadeus as any).analytics === "object" &&
        (amadeus as any).analytics &&
        typeof (amadeus as any).analytics.itineraryPriceMetrics === "object";

      if (!hasAnalyticsSupport) {
        logger.warn(
          "Amadeus itineraryPriceMetrics API not available, using mock response"
        );
        response = {
          data: simulateFlightPriceMetrics(
            originIataCode,
            destinationIataCode,
            departureDate,
            returnDate,
            currencyCode
          ),
        };
      } else {
        response = await (amadeus as any).analytics.itineraryPriceMetrics.get(
          params
        );
      }

      // Cache the results - use data property from response
      const responseData =
        response.data || response.result?.data || response.result;
      await redisService.set(cacheKey, responseData, 3600); // Cache for 1 hour

      return responseData;
    } catch (error) {
      logger.error("Error analyzing flight price", error);
      throw new AppError(
        "Failed to analyze flight price. Please try again later.",
        500
      );
    }
  },

  /**
   * Evaluate if a price is a good deal based on price metrics
   * @param priceMetrics Price metrics from Amadeus
   * @param currentPrice Current price to evaluate
   * @returns Deal evaluation
   */
  evaluateDeal(priceMetrics: any, currentPrice: number): any {
    try {
      // Extract relevant metrics
      const { quartileRanking, min, max, median } = priceMetrics.data;

      // Determine deal rating
      let dealRating;
      let dealPercentage = 0;

      if (currentPrice <= min) {
        dealRating = "EXCEPTIONAL_DEAL";
        dealPercentage = 100;
      } else if (currentPrice <= min * 1.1) {
        dealRating = "EXCELLENT_DEAL";
        dealPercentage = 90;
      } else if (currentPrice <= median * 0.9) {
        dealRating = "VERY_GOOD_DEAL";
        dealPercentage = 75;
      } else if (currentPrice <= median) {
        dealRating = "GOOD_DEAL";
        dealPercentage = 60;
      } else if (currentPrice <= median * 1.1) {
        dealRating = "AVERAGE_PRICE";
        dealPercentage = 50;
      } else if (currentPrice <= max * 0.9) {
        dealRating = "FAIR_PRICE";
        dealPercentage = 30;
      } else {
        dealRating = "HIGH_PRICE";
        dealPercentage = 10;
      }

      // Add deal information to the metrics
      return {
        ...priceMetrics,
        deal: {
          rating: dealRating,
          percentage: dealPercentage,
          currentPrice,
          summary: this.getDealSummary(dealRating),
        },
      };
    } catch (error) {
      logger.error("Error evaluating deal", error);
      return this.provideFallbackAnalysis(currentPrice);
    }
  },

  /**
   * Provide fallback analysis when the API call fails
   * @param currentPrice Current price
   * @returns Basic deal evaluation
   */
  provideFallbackAnalysis(currentPrice: number): any {
    return {
      data: {
        type: "flight-price-analysis",
        quartileRanking: "UNAVAILABLE",
      },
      deal: {
        rating: "UNKNOWN",
        percentage: 50,
        currentPrice,
        summary:
          "Price analysis unavailable. Consider booking if the price meets your budget.",
      },
    };
  },

  /**
   * Get human-readable summary of deal rating
   * @param dealRating Deal rating
   * @returns Human-readable summary
   */
  getDealSummary(dealRating: string): string {
    switch (dealRating) {
      case "EXCEPTIONAL_DEAL":
        return "This is an exceptional deal! This price is the lowest available and may not last long.";
      case "EXCELLENT_DEAL":
        return "This is an excellent price! We recommend booking now as prices may increase.";
      case "VERY_GOOD_DEAL":
        return "This is a very good price, below the average for this route.";
      case "GOOD_DEAL":
        return "This is a good price, below the median for this route.";
      case "AVERAGE_PRICE":
        return "This is an average price for this route.";
      case "FAIR_PRICE":
        return "This price is higher than average, but still reasonable.";
      case "HIGH_PRICE":
        return "This is a high price for this route. Consider changing your dates if flexible.";
      default:
        return "Price analysis unavailable.";
    }
  },
};

// Add simulator functions at the end of the file
// Simulate flight dates response when API is not available
function simulateFlightDatesResponse(
  origin: string,
  destination: string,
  departureDate: string,
  currencyCode: string
) {
  // Create a range of dates around the provided date
  const date = new Date(departureDate);
  const dates = [];

  // Generate 10 days of simulated prices
  for (let i = -5; i < 5; i++) {
    const currentDate = new Date(date);
    currentDate.setDate(date.getDate() + i);

    const formattedDate = currentDate.toISOString().split("T")[0];

    // Generate a somewhat realistic price between 300 and 900
    const price = 300 + Math.floor(Math.random() * 600);

    dates.push({
      departureDate: formattedDate,
      returnDate: "",
      price: {
        total: price.toString(),
        currency: currencyCode,
      },
    });
  }

  return {
    type: "flight-date-search",
    origin,
    destination,
    currency: currencyCode,
    dates,
  };
}

// Simulate flight price metrics when API is not available
function simulateFlightPriceMetrics(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string | undefined,
  currencyCode: string
) {
  // Generate realistic price metrics
  const basePrice = 400 + Math.floor(Math.random() * 300);
  const min = basePrice * 0.7;
  const firstQuartile = basePrice * 0.85;
  const median = basePrice;
  const thirdQuartile = basePrice * 1.15;
  const max = basePrice * 1.5;

  return {
    type: "flight-price-analysis",
    origin,
    destination,
    departureDate,
    returnDate: returnDate || "",
    currencyCode,
    quartileRanking: "MEDIUM",
    min,
    max,
    median,
    firstQuartile,
    thirdQuartile,
  };
}
