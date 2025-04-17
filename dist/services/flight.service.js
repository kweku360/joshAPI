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
exports.flightService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../utils/logger");
const redis_service_1 = require("./redis.service");
const appError_1 = require("../utils/appError");
const node_cache_1 = __importDefault(require("node-cache"));
const client_1 = require("@prisma/client");
// Cache duration for airport/city search results (24 hours)
const LOCATION_CACHE_TTL = 24 * 60 * 60;
// Cache duration for flight search results (5 minutes)
const FLIGHT_CACHE_TTL = 5 * 60;
// Create caches
const airportSearchCache = new node_cache_1.default({ stdTTL: LOCATION_CACHE_TTL });
const flightSearchCache = new node_cache_1.default({ stdTTL: FLIGHT_CACHE_TTL });
// Amadeus API client
class AmadeusAPI {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = null;
        this.prisma = new client_1.PrismaClient();
    }
    /**
     * Get access token for Amadeus API
     * @returns Access token
     */
    getToken() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
                return this.accessToken;
            }
            try {
                const baseUrl = config_1.default.amadeus.apiEnv === 'production'
                    ? 'https://api.amadeus.com'
                    : 'https://test.api.amadeus.com';
                const response = yield axios_1.default.post(`${baseUrl}/v1/security/oauth2/token`, new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: config_1.default.amadeus.clientId,
                    client_secret: config_1.default.amadeus.clientSecret,
                }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                });
                const token = response.data.access_token;
                if (!token) {
                    throw new appError_1.AppError('Invalid token received from Amadeus API', 500);
                }
                this.accessToken = token;
                this.tokenExpiry = Date.now() + response.data.expires_in * 1000;
                return token;
            }
            catch (error) {
                logger_1.logger.error('Error getting Amadeus token', {
                    error: error instanceof Error ? error.message : String(error)
                });
                throw new appError_1.AppError('Failed to authenticate with Amadeus API', 500);
            }
        });
    }
    /**
     * Make API request to Amadeus
     * @param method HTTP method
     * @param path API path
     * @param params Query parameters
     * @param data Request body
     * @returns API response
     */
    request(method, path, params, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const token = yield this.getToken();
                const baseURL = `https://${config_1.default.amadeus.apiEnv === "production" ? "" : "test."}api.amadeus.com`;
                const { data: responseData } = yield (0, axios_1.default)({
                    method,
                    url: `${baseURL}${path}`,
                    params,
                    data,
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });
                return responseData.data;
            }
            catch (error) {
                const amadeusError = error;
                if ((_b = (_a = amadeusError.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.errors) {
                    logger_1.logger.error(`Amadeus API error: ${JSON.stringify(amadeusError.response.data.errors)}`);
                    throw new Error(((_c = amadeusError.response.data.errors[0]) === null || _c === void 0 ? void 0 : _c.detail) || "Amadeus API error");
                }
                logger_1.logger.error(`Error calling Amadeus API: ${path}`, {
                    error: error instanceof Error ? error.message : String(error)
                });
                throw new Error("Error calling Amadeus API");
            }
        });
    }
    /**
     * Search for airports and cities
     * @param keyword Search keyword
     * @returns List of airports and cities
     */
    searchLocations(keyword) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check cache first
            const cacheKey = `amadeus_locations_${keyword.toLowerCase()}`;
            const cachedResults = yield redis_service_1.redisService.get(cacheKey);
            if (cachedResults) {
                logger_1.logger.info(`Using cached location results for: ${keyword}`);
                return cachedResults;
            }
            try {
                // Use the exact API endpoint format as in the Amadeus documentation
                logger_1.logger.info(`Searching Amadeus locations API with keyword: ${keyword}`);
                // Use the exact query parameters as documented in the Amadeus API
                const response = yield this.request("GET", "/v1/reference-data/locations", {
                    keyword,
                    subType: "CITY,AIRPORT", // Exact format from documentation
                    "page[limit]": 25,
                });
                logger_1.logger.info(`Amadeus returned ${response.length} locations for keyword: ${keyword}`);
                if (response.length > 0) {
                    // Cache valid results
                    yield redis_service_1.redisService.set(cacheKey, response, LOCATION_CACHE_TTL);
                    return response;
                }
                // If we got here, the attempt failed - try additional fallback only in test/dev
                if (config_1.default.amadeus.apiEnv !== "production") {
                    logger_1.logger.warn(`Amadeus API returned no results for: ${keyword}, using fallback in test/dev mode`);
                    // Use fallback only in non-production environments as a development convenience
                    const fallbackResults = this.getFallbackAirports(keyword);
                    if (fallbackResults.length > 0) {
                        // Cache fallback results with shorter TTL (4 hours)
                        yield redis_service_1.redisService.set(cacheKey, fallbackResults, 4 * 60 * 60);
                        return fallbackResults;
                    }
                }
                // Return empty array if no results found anywhere
                logger_1.logger.warn(`No locations found for keyword: ${keyword}`);
                return [];
            }
            catch (error) {
                logger_1.logger.error(`Error searching Amadeus locations: ${error instanceof Error ? error.message : String(error)}`);
                // Use fallback only in non-production as a last resort after API error
                if (config_1.default.amadeus.apiEnv !== "production") {
                    const fallbackResults = this.getFallbackAirports(keyword);
                    return fallbackResults.length > 0 ? fallbackResults : [];
                }
                return [];
            }
        });
    }
    /**
     * Get fallback airport data for common airports when Amadeus test environment fails
     */
    getFallbackAirports(keyword) {
        const commonAirports = [
            {
                type: "location",
                subType: "AIRPORT",
                name: "KOTOKA INTERNATIONAL AIRPORT",
                detailedName: "ACCRA/GH: KOTOKA INTERNATIONAL AIRPORT",
                id: "AACC",
                self: {
                    href: "https://test.api.amadeus.com/v1/reference-data/locations/AACC",
                    methods: ["GET"],
                },
                timeZoneOffset: "+00:00",
                iataCode: "ACC",
                geoCode: {
                    latitude: 5.605186,
                    longitude: -0.166786,
                },
                address: {
                    cityName: "ACCRA",
                    cityCode: "ACC",
                    countryName: "GHANA",
                    countryCode: "GH",
                    regionCode: "AFRICA",
                },
            },
            {
                type: "location",
                subType: "CITY",
                name: "ACCRA",
                detailedName: "ACCRA/GH",
                id: "CACC",
                self: {
                    href: "https://test.api.amadeus.com/v1/reference-data/locations/CACC",
                    methods: ["GET"],
                },
                timeZoneOffset: "+00:00",
                iataCode: "ACC",
                geoCode: {
                    latitude: 5.55,
                    longitude: -0.2,
                },
                address: {
                    cityName: "ACCRA",
                    cityCode: "ACC",
                    countryName: "GHANA",
                    countryCode: "GH",
                    regionCode: "AFRICA",
                },
            },
            {
                type: "location",
                subType: "AIRPORT",
                name: "MURTALA MUHAMMED INTERNATIONAL AIRPORT",
                detailedName: "LAGOS/NG: MURTALA MUHAMMED INTERNATIONAL AIRPORT",
                id: "ALOS",
                self: {
                    href: "https://test.api.amadeus.com/v1/reference-data/locations/ALOS",
                    methods: ["GET"],
                },
                timeZoneOffset: "+01:00",
                iataCode: "LOS",
                geoCode: {
                    latitude: 6.577369,
                    longitude: 3.321156,
                },
                address: {
                    cityName: "LAGOS",
                    cityCode: "LOS",
                    countryName: "NIGERIA",
                    countryCode: "NG",
                    regionCode: "AFRICA",
                },
            },
        ];
        const normalizedKeyword = keyword.toLowerCase();
        return commonAirports.filter((airport) => {
            return (airport.iataCode.toLowerCase() === normalizedKeyword ||
                airport.iataCode.toLowerCase().includes(normalizedKeyword) ||
                airport.address.cityName.toLowerCase().includes(normalizedKeyword) ||
                airport.name.toLowerCase().includes(normalizedKeyword) ||
                (airport.address.countryName &&
                    airport.address.countryName.toLowerCase().includes(normalizedKeyword)));
        });
    }
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
    searchFlightOffers(origin_1, destination_1, departureDate_1, returnDate_1) {
        return __awaiter(this, arguments, void 0, function* (origin, destination, departureDate, returnDate, adults = 1, children = 0, infants = 0, travelClass, maxResults = 20, currencyCode = "GHS") {
            const params = {
                originLocationCode: origin,
                destinationLocationCode: destination,
                departureDate,
                returnDate,
                adults,
                children,
                infants,
                travelClass,
                nonStop: false,
                currencyCode,
                maxPrice: undefined
            };
            return yield this.request("GET", "/v2/shopping/flight-offers", params);
        });
    }
    /**
     * Search for multi-city flight offers
     * @param payload Request payload
     * @returns Flight offers
     */
    searchMultiCityFlightOffers(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Ensure dates are properly formatted
                if (payload.originDestinations &&
                    Array.isArray(payload.originDestinations)) {
                    // Log original payload for debugging
                    logger_1.logger.info("Original multi-city payload before processing", {
                        originalDestinations: JSON.stringify(payload.originDestinations),
                    });
                    // Create a new array with proper date structure
                    const cleanSegments = payload.originDestinations.map((od) => {
                        var _a;
                        // Extract the date from the object
                        const dateValue = (_a = od.departureDateTimeRange) === null || _a === void 0 ? void 0 : _a.date;
                        // Log the extracted date for debugging
                        logger_1.logger.info(`Processing segment ${od.id}: date=${dateValue}`);
                        if (!dateValue || !dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            throw new Error(`Invalid date format for segment ${od.id}. Date must be in YYYY-MM-DD format.`);
                        }
                        // Create a new clean object with the date explicitly set
                        return {
                            id: od.id,
                            originLocationCode: od.originLocationCode,
                            destinationLocationCode: od.destinationLocationCode,
                            departureDateTimeRange: {
                                date: dateValue,
                            },
                        };
                    });
                    // Replace with clean segments
                    payload.originDestinations = cleanSegments;
                    // Log the processed payload
                    logger_1.logger.info("Processed multi-city payload", {
                        processedDestinations: JSON.stringify(payload.originDestinations),
                    });
                }
                logger_1.logger.info("Sending multi-city flight search to Amadeus", {
                    originDestinations: payload.originDestinations,
                    travelers: payload.travelers ? payload.travelers.length : 0,
                });
                return this.request("POST", "/v2/shopping/flight-offers", undefined, payload);
            }
            catch (error) {
                logger_1.logger.error("Error in searchMultiCityFlightOffers", error);
                throw error;
            }
        });
    }
    /**
     * Price flight offers
     * @param params Pricing params
     * @returns Pricing response
     */
    priceFlightOffers(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                // Basic validation
                if (!params.flightOffers) {
                    throw new appError_1.AppError("Missing flight offers data", 400);
                }
                // Normalize the flight offers - strictly as per Amadeus API requirements
                let flightOffersArray;
                // Convert to array if needed
                if (Array.isArray(params.flightOffers)) {
                    flightOffersArray = [...params.flightOffers]; // Create a copy to avoid modifying original
                }
                else if (typeof params.flightOffers === "object") {
                    if (Object.keys(params.flightOffers).some((key) => !isNaN(parseInt(key)))) {
                        // Object with numeric keys - convert to array
                        flightOffersArray = Object.values(params.flightOffers);
                    }
                    else {
                        // Single object - wrap in array
                        flightOffersArray = [params.flightOffers];
                    }
                }
                else {
                    throw new appError_1.AppError("Invalid flight offers format", 400);
                }
                // Ensure all nested structures are proper arrays
                flightOffersArray = flightOffersArray.map((offer) => {
                    const normalizedOffer = Object.assign({}, offer); // Create copy
                    // Fix itineraries
                    if (normalizedOffer.itineraries &&
                        !Array.isArray(normalizedOffer.itineraries)) {
                        normalizedOffer.itineraries = Object.values(normalizedOffer.itineraries);
                    }
                    // Fix segments in each itinerary
                    if (Array.isArray(normalizedOffer.itineraries)) {
                        normalizedOffer.itineraries = normalizedOffer.itineraries.map((itinerary) => {
                            const normalizedItinerary = Object.assign({}, itinerary);
                            if (normalizedItinerary.segments &&
                                !Array.isArray(normalizedItinerary.segments)) {
                                normalizedItinerary.segments = Object.values(normalizedItinerary.segments);
                            }
                            return normalizedItinerary;
                        });
                    }
                    // Fix other array properties
                    if (normalizedOffer.validatingAirlineCodes &&
                        !Array.isArray(normalizedOffer.validatingAirlineCodes)) {
                        normalizedOffer.validatingAirlineCodes = Object.values(normalizedOffer.validatingAirlineCodes);
                    }
                    if (normalizedOffer.pricingOptions &&
                        normalizedOffer.pricingOptions.fareType &&
                        !Array.isArray(normalizedOffer.pricingOptions.fareType)) {
                        normalizedOffer.pricingOptions.fareType = Object.values(normalizedOffer.pricingOptions.fareType);
                    }
                    if (normalizedOffer.price &&
                        normalizedOffer.price.fees &&
                        !Array.isArray(normalizedOffer.price.fees)) {
                        normalizedOffer.price.fees = Object.values(normalizedOffer.price.fees);
                    }
                    // Fix travelerPricings
                    if (normalizedOffer.travelerPricings &&
                        !Array.isArray(normalizedOffer.travelerPricings)) {
                        normalizedOffer.travelerPricings = Object.values(normalizedOffer.travelerPricings);
                        // Fix each travelerPricing
                        normalizedOffer.travelerPricings =
                            normalizedOffer.travelerPricings.map((pricing) => {
                                const normalizedPricing = Object.assign({}, pricing);
                                if (normalizedPricing.fareDetailsBySegment &&
                                    !Array.isArray(normalizedPricing.fareDetailsBySegment)) {
                                    normalizedPricing.fareDetailsBySegment = Object.values(normalizedPricing.fareDetailsBySegment);
                                }
                                return normalizedPricing;
                            });
                    }
                    return normalizedOffer;
                });
                // Construct the payload exactly as required by Amadeus API
                const payload = {
                    data: {
                        type: "flight-offers-pricing",
                        flightOffers: flightOffersArray,
                    },
                };
                // Add preferences section with currency if specified
                if (params.currencyCode) {
                    payload.data.preferences = {
                        currency: params.currencyCode,
                    };
                }
                // Log the final payload structure
                logger_1.logger.info("Pricing flight offers with Amadeus API", {
                    offersCount: flightOffersArray.length,
                    hasCurrency: !!params.currencyCode,
                });
                // Make the API request with the exact payload structure
                const response = yield axios_1.default.post(`https://${config_1.default.amadeus.apiEnv === "production" ? "" : "test."}api.amadeus.com/v1/shopping/flight-offers/pricing`, payload, {
                    headers: {
                        Authorization: `Bearer ${yield this.getToken()}`,
                        "Content-Type": "application/json",
                    },
                });
                return response.data;
            }
            catch (error) {
                // Log the specific error for debugging
                const amadeusError = error;
                if ((_b = (_a = amadeusError.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.errors) {
                    logger_1.logger.error("Amadeus API error in flight pricing:", {
                        errors: amadeusError.response.data.errors,
                        statusCode: amadeusError.response.status,
                    });
                }
                else {
                    logger_1.logger.error("Error in priceFlightOffers:", {
                        message: amadeusError instanceof Error ?
                            amadeusError.message :
                            String(error),
                    });
                }
                return this.handleAmadeusError(error, "Failed to price flight offers");
            }
        });
    }
    normalizeFlightOffer(offer) {
        return Object.assign(Object.assign({}, offer), { itineraries: offer.itineraries.map((itinerary) => (Object.assign(Object.assign({}, itinerary), { segments: Array.isArray(itinerary.segments) ? itinerary.segments : [] }))), travelerPricings: offer.travelerPricings.map((pricing) => (Object.assign(Object.assign({}, pricing), { fareDetailsBySegment: Array.isArray(pricing.fareDetailsBySegment)
                    ? pricing.fareDetailsBySegment
                    : [] }))) });
    }
    createFlightOrder(flightOffer, travelers, contacts) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const normalizedOffer = this.normalizeFlightOffer(flightOffer);
                const requestData = {
                    type: 'flight-order',
                    flightOffers: [normalizedOffer],
                    travelers,
                    contacts,
                    preferences: {
                        maxConnections: 2,
                        nonStop: false,
                    },
                };
                // Direct API call to avoid typing issues
                const { data: responseData } = yield axios_1.default.post(`https://${config_1.default.amadeus.apiEnv === "production" ? "" : "test."}api.amadeus.com/v1/booking/flight-orders`, { data: requestData }, {
                    headers: {
                        Authorization: `Bearer ${yield this.getToken()}`,
                        "Content-Type": "application/json",
                    },
                });
                return responseData.data;
            }
            catch (error) {
                if (error instanceof appError_1.AppError) {
                    throw error;
                }
                logger_1.logger.error('Error creating flight order', {
                    error: error instanceof Error ? error.message : String(error)
                });
                throw new appError_1.AppError('Failed to create flight order', 500);
            }
        });
    }
    /**
     * Search for flight dates by specific date
     */
    searchFlightDatesByDate(origin_1, destination_1, departureDate_1) {
        return __awaiter(this, arguments, void 0, function* (origin, destination, departureDate, currencyCode = "GHS") {
            try {
                logger_1.logger.info("Searching flight dates by specific date", {
                    origin,
                    destination,
                    departureDate,
                });
                // Ensure date is in YYYY-MM-DD format
                if (!departureDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    throw new appError_1.AppError("Departure date must be in YYYY-MM-DD format", 400);
                }
                // Generate cache key based on search parameters
                const cacheKey = `flight_dates_${origin}_${destination}_${departureDate}_${currencyCode}`;
                // Check cache first
                const cachedResult = flightSearchCache.get(cacheKey);
                if (cachedResult) {
                    logger_1.logger.info("Retrieved flight dates from cache", {
                        origin,
                        destination,
                        departureDate,
                    });
                    return cachedResult;
                }
                // Make API call to flight-dates endpoint
                const { data: responseData } = yield axios_1.default.get(`https://${config_1.default.amadeus.apiEnv === "production" ? "" : "test."}api.amadeus.com/v1/shopping/flight-dates`, {
                    params: {
                        origin,
                        destination,
                        departureDate,
                    },
                    headers: {
                        Authorization: `Bearer ${yield this.getToken()}`,
                        "Content-Type": "application/json",
                    }
                });
                // Cache the results
                flightSearchCache.set(cacheKey, responseData);
                return responseData;
            }
            catch (error) {
                return this.handleAmadeusError(error, "Failed to get cheapest flight dates");
            }
        });
    }
    /**
     * Search for flight dates using a duration (days from today)
     */
    searchFlightDatesByDuration(origin_1, destination_1, duration_1) {
        return __awaiter(this, arguments, void 0, function* (origin, destination, duration, currencyCode = "GHS") {
            try {
                logger_1.logger.info("Searching flight dates by duration", {
                    origin,
                    destination,
                    duration,
                });
                // Ensure duration is a positive number
                if (!duration || duration <= 0) {
                    throw new appError_1.AppError("Duration must be a positive number", 400);
                }
                // Generate cache key based on search parameters
                const cacheKey = `flight_dates_duration_${origin}_${destination}_${duration}_${currencyCode}`;
                // Check cache first
                const cachedResult = flightSearchCache.get(cacheKey);
                if (cachedResult) {
                    logger_1.logger.info("Retrieved flight dates from cache", {
                        origin,
                        destination,
                        duration,
                    });
                    return cachedResult;
                }
                // Make API call to flight-dates endpoint with duration
                const { data: responseData } = yield axios_1.default.get(`https://${config_1.default.amadeus.apiEnv === "production" ? "" : "test."}api.amadeus.com/v1/shopping/flight-dates`, {
                    params: {
                        origin,
                        destination,
                        duration,
                    },
                    headers: {
                        Authorization: `Bearer ${yield this.getToken()}`,
                        "Content-Type": "application/json",
                    }
                });
                // Cache the results
                flightSearchCache.set(cacheKey, responseData);
                return responseData;
            }
            catch (error) {
                return this.handleAmadeusError(error, "Failed to get cheapest flight dates");
            }
        });
    }
    /**
     * Search for flight availabilities
     */
    searchFlightAvailabilities(originDestinations_1, travelers_1) {
        return __awaiter(this, arguments, void 0, function* (originDestinations, travelers, sources = ["GDS"]) {
            try {
                logger_1.logger.info("Searching flight availabilities", {
                    origins: originDestinations.map((od) => od.originLocationCode),
                    destinations: originDestinations.map((od) => od.destinationLocationCode),
                    travelers: travelers.length,
                });
                // Validate input
                if (!originDestinations || originDestinations.length === 0) {
                    throw new appError_1.AppError("At least one origin-destination pair is required", 400);
                }
                if (!travelers || travelers.length === 0) {
                    throw new appError_1.AppError("At least one traveler is required", 400);
                }
                // Make API call to flight-availabilities endpoint
                const { data: responseData } = yield axios_1.default.post(`https://${config_1.default.amadeus.apiEnv === "production" ? "" : "test."}api.amadeus.com/v1/shopping/availability/flight-availabilities`, {
                    data: {
                        originDestinations,
                        travelers,
                        sources,
                    }
                }, {
                    headers: {
                        Authorization: `Bearer ${yield this.getToken()}`,
                        "Content-Type": "application/json",
                    }
                });
                return responseData;
            }
            catch (error) {
                return this.handleAmadeusError(error, "Failed to get flight availabilities");
            }
        });
    }
    /**
     * Handle errors from Amadeus API
     * @param error Error object
     * @param defaultMessage Default error message
     * @returns Error object with detailed message
     */
    handleAmadeusError(error, defaultMessage = "Amadeus API error") {
        var _a, _b;
        logger_1.logger.error("Amadeus API error", {
            error: error instanceof Error ? error.message : String(error)
        });
        const amadeusError = error;
        // Extract error details if available
        if ((_b = (_a = amadeusError.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.errors) {
            const errors = amadeusError.response.data.errors;
            const details = errors.map((e) => e.detail || e.title).join(", ");
            // Handle specific error cases
            if (details.includes("ORIGIN AND DESTINATION NOT SUPPORTED")) {
                throw new appError_1.AppError("The requested origin and destination pair is not supported for this search type. Please try different airports.", 400);
            }
            throw new appError_1.AppError(`Amadeus API error: ${details}`, amadeusError.response.status || 500);
        }
        // Handle network errors
        if (amadeusError.code === "ECONNREFUSED" || amadeusError.code === "ETIMEDOUT") {
            throw new appError_1.AppError("Unable to connect to flight data service. Please try again later.", 503);
        }
        // Generic error fallback
        throw new appError_1.AppError(defaultMessage, 500);
    }
}
// Create Amadeus API instance
const amadeusAPI = new AmadeusAPI();
exports.flightService = {
    /**
     * Search for airports and cities
     * @param keyword Search keyword
     * @returns List of airports and cities
     */
    searchLocations(keyword) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!keyword || keyword.length < 2) {
                return [];
            }
            const results = yield amadeusAPI.searchLocations(keyword);
            // Format results to ensure consistent structure
            return results.map((location) => {
                var _a, _b, _c, _d, _e;
                return (Object.assign(Object.assign({}, location), { type: location.type || "location", subType: location.subType || "", name: location.name || "", detailedName: location.detailedName || "", id: location.id || "", timeZoneOffset: location.timeZoneOffset || "", iataCode: location.iataCode || "", geoCode: location.geoCode || { latitude: 0, longitude: 0 }, address: {
                        cityName: ((_a = location.address) === null || _a === void 0 ? void 0 : _a.cityName) || "",
                        cityCode: ((_b = location.address) === null || _b === void 0 ? void 0 : _b.cityCode) || "",
                        countryName: ((_c = location.address) === null || _c === void 0 ? void 0 : _c.countryName) || "",
                        countryCode: ((_d = location.address) === null || _d === void 0 ? void 0 : _d.countryCode) || "",
                        regionCode: ((_e = location.address) === null || _e === void 0 ? void 0 : _e.regionCode) || "",
                    } }));
            });
        });
    },
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
    searchFlightOffers(origin_1, destination_1, departureDate_1, returnDate_1) {
        return __awaiter(this, arguments, void 0, function* (origin, destination, departureDate, returnDate, adults = 1, children = 0, infants = 0, travelClass, maxResults = 20, currencyCode = "GHS") {
            const results = yield amadeusAPI.searchFlightOffers(origin, destination, departureDate, returnDate, adults, children, infants, travelClass, maxResults, currencyCode);
            return results;
        });
    },
    /**
     * Search for multi-city flight offers
     */
    searchMultiCityFlightOffers(originDestinations_1) {
        return __awaiter(this, arguments, void 0, function* (originDestinations, adults = 1, children = 0, infants = 0, travelClass, currencyCode = "GHS") {
            return amadeusAPI.searchMultiCityFlightOffers({
                originDestinations,
                adults,
                children,
                infants,
                travelClass,
                currencyCode
            });
        });
    },
    /**
     * Price flight offers
     * @param flightOffers Flight offers to price
     * @returns Pricing information
     */
    priceFlightOffers(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return amadeusAPI.priceFlightOffers(params);
        });
    },
    /**
     * Search for flight dates by specific date
     */
    searchFlightDatesByDate(origin_1, destination_1, departureDate_1) {
        return __awaiter(this, arguments, void 0, function* (origin, destination, departureDate, currencyCode = "GHS") {
            return amadeusAPI.searchFlightDatesByDate(origin, destination, departureDate, currencyCode);
        });
    },
    /**
     * Search for flight dates using a duration
     */
    searchFlightDatesByDuration(origin_1, destination_1, duration_1) {
        return __awaiter(this, arguments, void 0, function* (origin, destination, duration, currencyCode = "GHS") {
            return amadeusAPI.searchFlightDatesByDuration(origin, destination, duration, currencyCode);
        });
    },
    /**
     * Search for flight availabilities
     */
    searchFlightAvailabilities(originDestinations_1, travelers_1) {
        return __awaiter(this, arguments, void 0, function* (originDestinations, travelers, sources = ["GDS"]) {
            return amadeusAPI.searchFlightAvailabilities(originDestinations, travelers, sources);
        });
    },
    /**
     * Create flight booking
     * @param flightOffer Flight offer to book
     * @param travelers Traveler information
     * @param contact Contact information
     * @returns Booking information
     */
    createFlightBooking(flightOffer, travelers, contact) {
        return __awaiter(this, void 0, void 0, function* () {
            return amadeusAPI.createFlightOrder(flightOffer, travelers, [contact]);
        });
    },
};
//# sourceMappingURL=flight.service.js.map