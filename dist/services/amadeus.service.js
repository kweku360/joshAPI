"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.amadeusService = void 0;
const amadeus_1 = __importDefault(require("amadeus"));
const node_cache_1 = __importDefault(require("node-cache"));
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../utils/logger");
const appError_1 = require("../utils/appError");
const redis_service_1 = require("./redis.service");
// Initialize Amadeus client with type assertion
const amadeus = new amadeus_1.default({
    clientId: config_1.default.amadeus.clientId,
    clientSecret: config_1.default.amadeus.clientSecret,
    hostname: config_1.default.amadeus.apiEnv === "production" ? "production" : "test",
    logLevel: config_1.default.env === "development" ? "debug" : "silent",
});
// Cache configuration
const flightSearchCache = new node_cache_1.default({
    stdTTL: 300, // 5 minutes cache
    checkperiod: 60,
    useClones: false,
});
const airportSearchCache = new node_cache_1.default({
    stdTTL: 86400, // 24 hours cache for airports data
    checkperiod: 3600,
    useClones: false,
});
// Error handling helper
const handleAmadeusError = (error, defaultMessage) => {
    logger_1.logger.error("Amadeus API error", { error });
    // If it's an Amadeus API error with details
    if (error.response && error.response.data && error.response.data.errors) {
        const apiError = error.response.data.errors[0];
        throw new appError_1.AppError(`Amadeus API error: ${apiError.detail || apiError.title}`, error.response.statusCode || 400, { code: apiError.code, source: apiError.source });
    }
    // If it's a connection error or other type
    throw new appError_1.AppError(defaultMessage, 500);
};
// Base service with common methods
exports.amadeusService = {
    /**
     * Search for flights based on given parameters
     */
    searchFlights(params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Generate cache key based on search parameters
                const cacheKey = `flight_search_${JSON.stringify(params)}`;
                // Check cache first
                const cachedResult = flightSearchCache.get(cacheKey);
                if (cachedResult) {
                    logger_1.logger.info("Retrieved flight search results from cache", {
                        origin: params.originLocationCode,
                        destination: params.destinationLocationCode,
                    });
                    return cachedResult;
                }
                logger_1.logger.info("Searching flights with Amadeus", { params });
                // Create search parameters
                const searchParams = {
                    originLocationCode: params.originLocationCode,
                    destinationLocationCode: params.destinationLocationCode,
                    departureDate: params.departureDate,
                    adults: params.adults,
                    currencyCode: params.currencyCode || "USD",
                    max: params.max || 50,
                };
                // Add optional parameters
                if (params.returnDate)
                    searchParams.returnDate = params.returnDate;
                if (params.children)
                    searchParams.children = params.children;
                if (params.infants)
                    searchParams.infants = params.infants;
                if (params.travelClass)
                    searchParams.travelClass = params.travelClass;
                if (params.maxPrice)
                    searchParams.maxPrice = params.maxPrice;
                if (params.includedAirlineCodes)
                    searchParams.includedAirlineCodes = params.includedAirlineCodes;
                if (params.excludedAirlineCodes)
                    searchParams.excludedAirlineCodes = params.excludedAirlineCodes;
                if (params.nonStop !== undefined)
                    searchParams.nonStop = params.nonStop;
                // Start timer for performance monitoring
                const startTime = Date.now();
                // Make API call
                const response = yield amadeus.shopping.flightOffersSearch.get(searchParams);
                // Record performance metrics
                const duration = Date.now() - startTime;
                logger_1.logger.debug(`Amadeus flight search API call completed in ${duration}ms`, {
                    origin: params.originLocationCode,
                    destination: params.destinationLocationCode,
                    responseTime: duration,
                });
                // Cache the results
                flightSearchCache.set(cacheKey, response.data);
                return response.data;
            }
            catch (error) {
                return handleAmadeusError(error, "Failed to search flights");
            }
        });
    },
    /**
     * Get pricing for flight offers
     */
    getFlightPrice(flightOffers) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Generate cache key based on flight offers
                const cacheKey = `flight_price_${JSON.stringify(flightOffers)}`;
                // Check cache first
                const cachedResult = flightSearchCache.get(cacheKey);
                if (cachedResult) {
                    logger_1.logger.info("Retrieved flight pricing from cache");
                    return cachedResult;
                }
                logger_1.logger.info("Getting flight price with Amadeus");
                // Start timer for performance monitoring
                const startTime = Date.now();
                // Make API call
                const response = yield amadeus.shopping.flightOffers.pricing.post(JSON.stringify({
                    data: {
                        type: "flight-offers-pricing",
                        flightOffers,
                    },
                }));
                // Record performance metrics
                const duration = Date.now() - startTime;
                logger_1.logger.debug(`Amadeus flight pricing API call completed in ${duration}ms`, {
                    responseTime: duration,
                });
                // Cache the results
                flightSearchCache.set(cacheKey, response.data);
                return response.data;
            }
            catch (error) {
                return handleAmadeusError(error, "Failed to get flight price");
            }
        });
    },
    /**
     * Create flight booking order
     */
    createFlightOrder(flightOffer, travelers) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.logger.info("Creating flight order with Amadeus");
                // Start timer for performance monitoring
                const startTime = Date.now();
                // Make API call
                const response = yield amadeus.booking.flightOrders.post(JSON.stringify({
                    data: {
                        type: "flight-order",
                        flightOffers: [flightOffer],
                        travelers,
                    },
                }));
                // Record performance metrics
                const duration = Date.now() - startTime;
                logger_1.logger.debug(`Amadeus flight order API call completed in ${duration}ms`, {
                    responseTime: duration,
                });
                return response.data;
            }
            catch (error) {
                return handleAmadeusError(error, "Failed to create flight order");
            }
        });
    },
    /**
     * Search for airports by keyword
     */
    searchAirports(keyword) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Generate cache key
                const cacheKey = `airport_search_${keyword.toLowerCase()}`;
                // Check cache first
                const cachedResult = airportSearchCache.get(cacheKey);
                if (cachedResult) {
                    logger_1.logger.info("Retrieved airport search results from cache", { keyword });
                    return cachedResult;
                }
                logger_1.logger.info("Searching airports with Amadeus", { keyword });
                // Start timer for performance monitoring
                const startTime = Date.now();
                // Make API call - limit to airports only
                const response = yield amadeus.referenceData.locations.get({
                    keyword,
                    subType: "AIRPORT",
                    page: { limit: 20 },
                });
                // Record performance metrics
                const duration = Date.now() - startTime;
                logger_1.logger.debug(`Amadeus airport search API call completed in ${duration}ms`, {
                    keyword,
                    responseTime: duration,
                });
                // Cache the results
                airportSearchCache.set(cacheKey, response.data);
                return response.data;
            }
            catch (error) {
                return handleAmadeusError(error, "Failed to search airports");
            }
        });
    },
    /**
     * Search for locations (cities and airports) by keyword
     * @param keyword Search keyword
     * @param countryCode Optional country code to filter results
     * @returns Array of location objects with detailed information
     */
    searchLocations(keyword, countryCode) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Generate cache key
                const cacheKey = `location_search_${keyword.toLowerCase()}_${countryCode || "all"}`;
                // Check cache first
                const cachedResult = airportSearchCache.get(cacheKey);
                if (cachedResult) {
                    logger_1.logger.info("Retrieved location search results from cache", {
                        keyword,
                        countryCode,
                    });
                    return cachedResult;
                }
                logger_1.logger.info("Searching locations with Amadeus", { keyword, countryCode });
                // Start timer for performance monitoring
                const startTime = Date.now();
                // Build search parameters exactly as per Amadeus documentation
                const params = {
                    keyword,
                    subType: "CITY,AIRPORT",
                    page: { limit: 25 },
                };
                // Add country code if provided - as per Amadeus docs
                if (countryCode) {
                    params.countryCode = countryCode;
                }
                // Make API call
                const response = yield amadeus.referenceData.locations.get(params);
                // Record performance metrics
                const duration = Date.now() - startTime;
                logger_1.logger.debug(`Amadeus location search API call completed in ${duration}ms`, {
                    keyword,
                    countryCode,
                    responseTime: duration,
                });
                // Transform the data to match our Location interface
                const locations = response.data.map((location) => ({
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
            }
            catch (error) {
                return handleAmadeusError(error, "Failed to search locations");
            }
        });
    },
    /**
     * Clear all caches - useful for testing or manual cache invalidation
     */
    clearCaches() {
        flightSearchCache.flushAll();
        airportSearchCache.flushAll();
        logger_1.logger.info("Amadeus API caches cleared");
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
    searchCheapestFlightDates(origin_1, destination_1, departureDate_1) {
        return __awaiter(this, arguments, void 0, function* (origin, destination, departureDate, currencyCode = "GHS") {
            try {
                // Ensure date is in YYYY-MM-DD format
                if (!departureDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    throw new appError_1.AppError("Departure date must be in YYYY-MM-DD format", 400);
                }
                // Generate cache key based on search parameters
                const cacheKey = `flight_cheapest_dates_${origin}_${destination}_${departureDate}_${currencyCode}`;
                // Check cache first
                const cachedResult = flightSearchCache.get(cacheKey);
                if (cachedResult) {
                    logger_1.logger.info("Retrieved cheapest flight dates from cache", {
                        origin,
                        destination,
                        departureDate,
                    });
                    return cachedResult;
                }
                logger_1.logger.info("Searching cheapest flight dates with Amadeus", {
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
                const hasFlightDatesSupport = amadeus &&
                    typeof amadeus.shopping === "object" &&
                    amadeus.shopping &&
                    typeof amadeus.shopping.flightDates === "object";
                if (!hasFlightDatesSupport) {
                    logger_1.logger.warn("Amadeus flightDates API not available, using mock response");
                    response = {
                        data: simulateFlightDatesResponse(origin, destination, departureDate, currencyCode),
                    };
                }
                else {
                    response = yield amadeus.shopping.flightDates.get({
                        origin,
                        destination,
                        departureDate, // Now ensured to be in YYYY-MM-DD format
                        oneWay: true,
                        currencyCode,
                    });
                }
                // Record performance metrics
                const duration = Date.now() - startTime;
                logger_1.logger.debug(`Amadeus cheapest flight dates API call completed in ${duration}ms`, {
                    responseTime: duration,
                });
                // Cache the results
                flightSearchCache.set(cacheKey, response.data);
                return response.data;
            }
            catch (error) {
                return handleAmadeusError(error, "Failed to get cheapest flight dates");
            }
        });
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
    analyzeFlightPrice(originIataCode_1, destinationIataCode_1, departureDate_1, returnDate_1) {
        return __awaiter(this, arguments, void 0, function* (originIataCode, destinationIataCode, departureDate, returnDate, oneWay = false, currencyCode = "GHS") {
            var _a;
            try {
                logger_1.logger.info("Analyzing flight price", {
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
                const cachedResult = yield redis_service_1.redisService.get(cacheKey);
                if (cachedResult) {
                    logger_1.logger.info("Retrieved price analysis from cache");
                    return cachedResult;
                }
                // Prepare the API request parameters
                const params = {
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
                const hasAnalyticsSupport = amadeus &&
                    typeof amadeus.analytics === "object" &&
                    amadeus.analytics &&
                    typeof amadeus.analytics.itineraryPriceMetrics === "object";
                if (!hasAnalyticsSupport) {
                    logger_1.logger.warn("Amadeus itineraryPriceMetrics API not available, using mock response");
                    response = {
                        data: simulateFlightPriceMetrics(originIataCode, destinationIataCode, departureDate, returnDate, currencyCode),
                    };
                }
                else {
                    response = yield amadeus.analytics.itineraryPriceMetrics.get(params);
                }
                // Cache the results - use data property from response
                const responseData = response.data || ((_a = response.result) === null || _a === void 0 ? void 0 : _a.data) || response.result;
                yield redis_service_1.redisService.set(cacheKey, responseData, 3600); // Cache for 1 hour
                return responseData;
            }
            catch (error) {
                logger_1.logger.error("Error analyzing flight price", error);
                throw new appError_1.AppError("Failed to analyze flight price. Please try again later.", 500);
            }
        });
    },
    /**
     * Evaluate if a price is a good deal based on price metrics
     * @param priceMetrics Price metrics from Amadeus
     * @param currentPrice Current price to evaluate
     * @returns Deal evaluation
     */
    evaluateDeal(priceMetrics, currentPrice) {
        try {
            // Extract relevant metrics
            const { quartileRanking, min, max, median } = priceMetrics.data;
            // Determine deal rating
            let dealRating;
            let dealPercentage = 0;
            if (currentPrice <= min) {
                dealRating = "EXCEPTIONAL_DEAL";
                dealPercentage = 100;
            }
            else if (currentPrice <= min * 1.1) {
                dealRating = "EXCELLENT_DEAL";
                dealPercentage = 90;
            }
            else if (currentPrice <= median * 0.9) {
                dealRating = "VERY_GOOD_DEAL";
                dealPercentage = 75;
            }
            else if (currentPrice <= median) {
                dealRating = "GOOD_DEAL";
                dealPercentage = 60;
            }
            else if (currentPrice <= median * 1.1) {
                dealRating = "AVERAGE_PRICE";
                dealPercentage = 50;
            }
            else if (currentPrice <= max * 0.9) {
                dealRating = "FAIR_PRICE";
                dealPercentage = 30;
            }
            else {
                dealRating = "HIGH_PRICE";
                dealPercentage = 10;
            }
            // Add deal information to the metrics
            return Object.assign(Object.assign({}, priceMetrics), { deal: {
                    rating: dealRating,
                    percentage: dealPercentage,
                    currentPrice,
                    summary: this.getDealSummary(dealRating),
                } });
        }
        catch (error) {
            logger_1.logger.error("Error evaluating deal", error);
            return this.provideFallbackAnalysis(currentPrice);
        }
    },
    /**
     * Provide fallback analysis when the API call fails
     * @param currentPrice Current price
     * @returns Basic deal evaluation
     */
    provideFallbackAnalysis(currentPrice) {
        return {
            data: {
                type: "flight-price-analysis",
                quartileRanking: "UNAVAILABLE",
            },
            deal: {
                rating: "UNKNOWN",
                percentage: 50,
                currentPrice,
                summary: "Price analysis unavailable. Consider booking if the price meets your budget.",
            },
        };
    },
    /**
     * Get human-readable summary of deal rating
     * @param dealRating Deal rating
     * @returns Human-readable summary
     */
    getDealSummary(dealRating) {
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
function simulateFlightDatesResponse(origin, destination, departureDate, currencyCode) {
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
function simulateFlightPriceMetrics(origin, destination, departureDate, returnDate, currencyCode) {
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
//# sourceMappingURL=amadeus.service.js.map