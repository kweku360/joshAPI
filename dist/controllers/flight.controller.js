"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.flightController = void 0;
const amadeus_service_1 = require("../services/amadeus.service");
const auth_service_1 = require("../services/auth.service");
const booking_service_1 = require("../services/booking.service");
const email_service_1 = require("../services/email.service");
const redis_service_1 = require("../services/redis.service");
const appError_1 = require("../utils/appError");
const validator_1 = require("../utils/validator");
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const security_1 = require("../utils/security");
const perf_hooks_1 = require("perf_hooks");
const flight_service_1 = require("../services/flight.service");
// Schema definitions - moved outside function for reuse and performance
const flightSearchSchema = zod_1.z
    .object({
    origin: zod_1.z
        .string()
        .min(3, "Origin must be at least 3 characters")
        .max(3, "Airport code must be exactly 3 characters")
        .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Origin must be a valid 3-letter IATA code (uppercase)",
    })
        .optional(),
    originLocationCode: zod_1.z
        .string()
        .min(3, "Origin must be at least 3 characters")
        .max(3, "Airport code must be exactly 3 characters")
        .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Origin must be a valid 3-letter IATA code (uppercase)",
    })
        .optional(),
    destination: zod_1.z
        .string()
        .min(3, "Destination must be at least 3 characters")
        .max(3, "Airport code must be exactly 3 characters")
        .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Destination must be a valid 3-letter IATA code (uppercase)",
    })
        .optional(),
    destinationLocationCode: zod_1.z
        .string()
        .min(3, "Destination must be at least 3 characters")
        .max(3, "Airport code must be exactly 3 characters")
        .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Destination must be a valid 3-letter IATA code (uppercase)",
    })
        .optional(),
    departureDate: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Departure date must be in YYYY-MM-DD format")
        .refine((val) => {
        const date = new Date(val);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
    }, {
        message: "Departure date must be today or in the future",
    }),
    returnDate: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Return date must be in YYYY-MM-DD format")
        .refine((val) => {
        const date = new Date(val);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
    }, {
        message: "Return date must be today or in the future",
    })
        .optional(),
    adults: zod_1.z.coerce
        .number()
        .int()
        .min(1, "At least 1 adult is required")
        .max(9, "Maximum 9 adults allowed"),
    children: zod_1.z.coerce
        .number()
        .int()
        .min(0)
        .max(9, "Maximum 9 children allowed")
        .optional(),
    infants: zod_1.z.coerce
        .number()
        .int()
        .min(0)
        .max(9, "Maximum 9 infants allowed")
        .optional(),
    travelClass: zod_1.z
        .enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"])
        .optional(),
    currencyCode: zod_1.z
        .string()
        .length(3, "Currency code must be exactly 3 characters")
        .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Currency code must be a valid 3-letter code (uppercase)",
    })
        .optional(),
    currency: zod_1.z
        .string()
        .length(3, "Currency code must be exactly 3 characters")
        .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Currency code must be a valid 3-letter code (uppercase)",
    })
        .optional(),
    maxPrice: zod_1.z.coerce.number().positive("Price must be positive").optional(),
    max: zod_1.z.coerce
        .number()
        .int()
        .positive()
        .max(100, "Maximum 100 results allowed")
        .optional(),
    includedAirlineCodes: zod_1.z
        .string()
        .refine((val) => /^[A-Z0-9]{2}(,[A-Z0-9]{2})*$/.test(val), {
        message: "Airline codes must be comma-separated 2-letter codes",
    })
        .optional(),
    nonStop: zod_1.z.preprocess((val) => val === "true" || val === true, zod_1.z.boolean().optional()),
    oneWay: zod_1.z.preprocess((val) => val === "true" || val === true, zod_1.z.boolean().optional()),
    tripType: zod_1.z.enum(["one-way", "round-trip", "multi-city"]).optional(),
})
    .superRefine((data, ctx) => {
    // Require either origin or originLocationCode
    if (!data.origin && !data.originLocationCode) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Either origin or originLocationCode is required",
            path: ["origin"],
        });
    }
    // Require either destination or destinationLocationCode
    if (!data.destination && !data.destinationLocationCode) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Either destination or destinationLocationCode is required",
            path: ["destination"],
        });
    }
});
const flightPriceSchema = zod_1.z.object({
    flightOffers: zod_1.z
        .array(zod_1.z.any())
        .min(1, "At least one flight offer is required"),
});
const airportSearchSchema = zod_1.z.object({
    keyword: zod_1.z.string().min(2, "Keyword must be at least 2 characters"),
});
const locationSearchSchema = zod_1.z.object({
    keyword: zod_1.z.string().min(2, "Keyword must be at least 2 characters"),
    countryCode: zod_1.z
        .string()
        .length(2, "Country code must be exactly 2 characters")
        .refine((val) => /^[A-Z]{2}$/.test(val), {
        message: "Country code must be a valid 2-letter ISO code (uppercase)",
    })
        .optional(),
});
// Additional schemas for new endpoints
const flightOfferIdSchema = zod_1.z.object({
    offerId: zod_1.z.string().min(1, "Flight offer ID is required"),
});
const bookFlightSchema = zod_1.z.object({
    flightOfferId: zod_1.z.string().min(1, "Flight offer ID is required"),
    flightOfferData: zod_1.z.any(),
    passengerDetails: zod_1.z
        .array(zod_1.z.object({
        firstName: zod_1.z
            .string()
            .min(2, "First name must be at least 2 characters"),
        lastName: zod_1.z.string().min(2, "Last name must be at least 2 characters"),
        dateOfBirth: zod_1.z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
        gender: zod_1.z.enum(["MALE", "FEMALE", "UNSPECIFIED"]).optional(),
        email: zod_1.z.string().email("Invalid email address"),
        phone: zod_1.z.string().optional(),
        documentType: zod_1.z.enum(["PASSPORT", "ID_CARD", "VISA"]).optional(),
        documentNumber: zod_1.z.string().optional(),
        documentIssuingCountry: zod_1.z
            .string()
            .length(2, "Country code must be 2 characters")
            .optional(),
        documentExpiryDate: zod_1.z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be in YYYY-MM-DD format")
            .optional(),
    }))
        .min(1, "At least one passenger is required"),
    contactEmail: zod_1.z.string().email("Invalid contact email address"),
    contactPhone: zod_1.z.string().optional(),
    verificationCode: zod_1.z.string().optional(), // OTP verification code if required
});
const flightSearchDateSchema = zod_1.z
    .object({
    origin: zod_1.z
        .string()
        .min(3, "Origin must be at least 3 characters")
        .max(3, "Airport code must be exactly 3 characters")
        .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Origin must be a valid 3-letter IATA code (uppercase)",
    }),
    destination: zod_1.z
        .string()
        .min(3, "Destination must be at least 3 characters")
        .max(3, "Airport code must be exactly 3 characters")
        .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Destination must be a valid 3-letter IATA code (uppercase)",
    }),
    departureDate: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Departure date must be in YYYY-MM-DD format")
        .optional(),
    duration: zod_1.z.coerce
        .number()
        .int()
        .positive("Duration must be a positive integer")
        .optional(),
    currencyCode: zod_1.z
        .string()
        .length(3, "Currency code must be exactly 3 characters")
        .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Currency code must be a valid 3-letter code (uppercase)",
    })
        .optional(),
})
    .refine((data) => data.departureDate || data.duration, {
    message: "Either departureDate or duration must be provided",
    path: ["departureDate"],
});
// Add a new schema for price analysis requests
const priceAnalysisSchema = zod_1.z.object({
    originIataCode: zod_1.z
        .string()
        .length(3, "Origin must be exactly 3 characters")
        .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Origin must be a valid 3-letter IATA code (uppercase)",
    }),
    destinationIataCode: zod_1.z
        .string()
        .length(3, "Destination must be exactly 3 characters")
        .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Destination must be a valid 3-letter IATA code (uppercase)",
    }),
    departureDate: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Departure date must be in YYYY-MM-DD format"),
    returnDate: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Return date must be in YYYY-MM-DD format")
        .optional(),
    currencyCode: zod_1.z
        .string()
        .length(3, "Currency code must be exactly 3 characters")
        .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Currency code must be a valid 3-letter code (uppercase)",
    })
        .optional(),
    oneWay: zod_1.z.preprocess((val) => val === "true" || val === true, zod_1.z.boolean().optional()),
});
exports.flightController = {
    /**
     * Search for flights based on criteria
     */
    searchFlights(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = perf_hooks_1.performance.now();
            try {
                logger_1.logger.info("Flight search request", {
                    ip: req.ip,
                    userAgent: req.headers["user-agent"],
                    body: req.body, // Log the body instead of query
                });
                // Determine if this is a GET or POST request and use appropriate data source
                const requestData = req.method === "GET" ? req.query : req.body;
                // Validate request data
                const validationResult = flightSearchSchema.safeParse(requestData);
                if (!validationResult.success) {
                    return res.status(400).json({
                        status: "error",
                        errors: validationResult.error.issues,
                        message: "Invalid request parameters",
                    });
                }
                const data = validationResult.data;
                // Normalize parameters - support both naming conventions
                const originIataCode = data.originLocationCode || data.origin;
                const destinationIataCode = data.destinationLocationCode || data.destination;
                const currencyCode = data.currencyCode || data.currency || "GHS";
                // Check if origin and destination are the same
                if (originIataCode === destinationIataCode) {
                    return res.status(400).json({
                        status: "error",
                        message: "Origin and destination cannot be the same",
                    });
                }
                const tripType = data.tripType ||
                    (data.oneWay ? "one-way" : data.returnDate ? "round-trip" : "one-way");
                // Begin processing based on trip type
                if (tripType === "one-way" || tripType === "round-trip") {
                    const adults = Number(data.adults) || 1;
                    const children = Number(data.children) || 0;
                    const infants = Number(data.infants) || 0;
                    const travelClass = data.travelClass || "ECONOMY";
                    const nonStop = data.nonStop || false;
                    const max = Number(data.max) || 20;
                    const maxPrice = data.maxPrice;
                    const includedAirlineCodes = data.includedAirlineCodes;
                    const isOneWay = tripType === "one-way" || data.oneWay === true;
                    const flightOffers = yield flight_service_1.flightService.searchFlightOffers(originIataCode || "", destinationIataCode || "", data.departureDate, !isOneWay ? data.returnDate : undefined, adults, children, infants, travelClass, max, currencyCode);
                    return res.status(200).json({
                        status: "success",
                        currency: currencyCode,
                        data: {
                            flightOffers,
                        },
                    });
                }
                else if (tripType === "multi-city") {
                    return res.status(400).json({
                        status: "error",
                        message: "For multi-city trips, please use the advanced flight search endpoint",
                    });
                }
                else {
                    return res.status(400).json({
                        status: "error",
                        message: "Invalid trip type specified",
                    });
                }
            }
            catch (error) {
                logger_1.logger.error("Error searching for flights", {
                    query: req.query,
                    body: req.body,
                    error: error instanceof Error ? error.message : String(error),
                });
                return res.status(500).json({
                    status: "error",
                    message: "An error occurred while searching for flights",
                });
            }
        });
    },
    /**
     * Search for locations (airports and cities) by keyword
     * @route GET /api/flights/locations
     * @access Public
     * @example GET /api/flights/locations?keyword=MUC&countryCode=DE
     */
    searchLocations(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = perf_hooks_1.performance.now();
            try {
                // Log the request
                logger_1.logger.info("Location search request", {
                    ip: req.ip,
                    userAgent: req.headers["user-agent"],
                    query: req.query,
                });
                // Validate request query
                const validatedData = (0, validator_1.validateRequest)(req.query, locationSearchSchema);
                // Sanitize keyword input
                const keyword = (0, security_1.sanitizeInput)(validatedData.keyword);
                const countryCode = validatedData.countryCode
                    ? (0, security_1.sanitizeInput)(validatedData.countryCode)
                    : undefined;
                // Search locations using the Amadeus service
                const locations = yield amadeus_service_1.amadeusService.searchLocations(keyword, countryCode);
                // Add cache headers - location data changes less frequently
                res.set("Cache-Control", "public, max-age=86400"); // 24 hour cache
                res.set("ETag", `W/"location-${keyword}-${countryCode || "all"}"`);
                // Add performance timing header
                const endTime = perf_hooks_1.performance.now();
                res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);
                // Return response - format matches Amadeus API structure
                res.status(200).json({
                    status: "success",
                    results: locations.length,
                    data: {
                        locations,
                    },
                });
            }
            catch (error) {
                logger_1.logger.error("Location search error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    query: req.query,
                });
                next(error);
            }
        });
    },
    /**
     * Get pricing for selected flight offers
     */
    getFlightPrice(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const startTime = perf_hooks_1.performance.now();
            try {
                logger_1.logger.info("Flight price request", {
                    ip: req.ip,
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                });
                // Validate request body
                const validatedData = (0, validator_1.validateRequest)(req.body, flightPriceSchema);
                // Get flight price
                const flightPrice = yield amadeus_service_1.amadeusService.getFlightPrice(validatedData.flightOffers);
                // Add performance timing header
                const endTime = perf_hooks_1.performance.now();
                res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);
                // Return response
                res.status(200).json({
                    status: "success",
                    data: {
                        flightPrice,
                    },
                });
            }
            catch (error) {
                logger_1.logger.error("Flight price error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                });
                next(error);
            }
        });
    },
    /**
     * Search for airports and cities by keyword
     */
    searchAirports(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = perf_hooks_1.performance.now();
            try {
                // Validate request query
                const validatedData = (0, validator_1.validateRequest)(req.query, airportSearchSchema);
                // Sanitize keyword input
                const keyword = (0, security_1.sanitizeInput)(validatedData.keyword);
                // Search airports
                const airports = yield amadeus_service_1.amadeusService.searchAirports(keyword);
                // Add cache headers - airport data changes less frequently
                res.set("Cache-Control", "public, max-age=86400"); // 24 hour cache
                // Add performance timing header
                const endTime = perf_hooks_1.performance.now();
                res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);
                // Return response
                res.status(200).json({
                    status: "success",
                    results: airports.length,
                    data: {
                        airports,
                    },
                });
            }
            catch (error) {
                logger_1.logger.error("Airport search error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    query: req.query,
                });
                next(error);
            }
        });
    },
    /**
     * Verify a flight offer is still valid and get updated pricing
     */
    verifyFlightOffer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const startTime = perf_hooks_1.performance.now();
            try {
                // Validate request params
                const validatedParams = (0, validator_1.validateRequest)(req.params, flightOfferIdSchema);
                // Get the offer from cache or database
                // In a real implementation, you would retrieve the specific flight offer
                const offerId = (0, security_1.sanitizeInput)(validatedParams.offerId);
                logger_1.logger.info(`Verifying flight offer: ${offerId}`, {
                    userId: ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || "guest",
                    ip: req.ip,
                });
                // Retrieve the original offer from the request body or cache
                const flightOffers = req.body.flightOffers ||
                    (yield redis_service_1.redisService.get(`flight_offer_${offerId}`));
                if (!flightOffers) {
                    throw new appError_1.AppError("Flight offer not found or expired", 404);
                }
                // Verify with Amadeus
                const verifiedOffer = yield amadeus_service_1.amadeusService.getFlightPrice([flightOffers]);
                // Check for price changes or availability changes
                const originalPrice = (_b = flightOffers.price) === null || _b === void 0 ? void 0 : _b.total;
                const newPrice = (_d = (_c = verifiedOffer.flightOffers[0]) === null || _c === void 0 ? void 0 : _c.price) === null || _d === void 0 ? void 0 : _d.total;
                // Price change or availability check
                let priceChanged = false;
                let seatsAvailable = true;
                if (originalPrice !== newPrice) {
                    priceChanged = true;
                }
                if (((_e = verifiedOffer.flightOffers[0]) === null || _e === void 0 ? void 0 : _e.numberOfBookableSeats) < 1) {
                    seatsAvailable = false;
                }
                // Set a short expiration time for verified offers (10 minutes)
                yield redis_service_1.redisService.set(`verified_flight_offer_${offerId}`, verifiedOffer.flightOffers[0], 600);
                // Add performance timing header
                const endTime = perf_hooks_1.performance.now();
                res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);
                // Return response
                res.status(200).json({
                    status: "success",
                    data: {
                        flightOffer: verifiedOffer.flightOffers[0],
                        priceChanged,
                        originalPrice,
                        newPrice,
                        seatsAvailable,
                        expiration: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
                    },
                });
            }
            catch (error) {
                logger_1.logger.error("Flight offer verification error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    offerId: req.params.offerId,
                });
                // If it's an Amadeus error about expired offers
                if (error instanceof appError_1.AppError && error.message.includes("expired")) {
                    return next(new appError_1.AppError("This flight offer has expired. Please search again.", 410));
                }
                next(error);
            }
        });
    },
    /**
     * Book a flight with provided passenger details
     * Handles both guest and authenticated users
     */
    bookFlight(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const startTime = perf_hooks_1.performance.now();
            try {
                // Validate request body
                const validatedData = (0, validator_1.validateRequest)(req.body, bookFlightSchema);
                // Sanitize passenger details
                const sanitizedPassengers = validatedData.passengerDetails.map((passenger, index) => ({
                    id: `${index + 1}`, // Amadeus requires numeric IDs as strings
                    firstName: (0, security_1.sanitizeInput)(passenger.firstName),
                    lastName: (0, security_1.sanitizeInput)(passenger.lastName),
                    dateOfBirth: passenger.dateOfBirth,
                    gender: passenger.gender || "UNSPECIFIED",
                    email: (0, security_1.sanitizeInput)(passenger.email),
                    phone: passenger.phone ? (0, security_1.sanitizeInput)(passenger.phone) : undefined,
                    documentType: passenger.documentType,
                    documentNumber: passenger.documentNumber
                        ? (0, security_1.sanitizeInput)(passenger.documentNumber)
                        : undefined,
                    documentIssuingCountry: passenger.documentIssuingCountry,
                    documentExpiryDate: passenger.documentExpiryDate,
                }));
                // Check if email verification is needed for guest booking
                const contactEmail = (0, security_1.sanitizeInput)(validatedData.contactEmail);
                const isAuthenticated = !!req.user;
                if (!isAuthenticated) {
                    // For guest booking, verify the email with OTP
                    if (!validatedData.verificationCode) {
                        // First request - generate OTP and send email
                        const otp = Math.floor(100000 + Math.random() * 900000).toString();
                        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
                        // Save OTP for verification
                        yield redis_service_1.redisService.set(`otp_${contactEmail}`, otp, 900 // 15 minutes in seconds
                        );
                        // Send OTP email
                        yield email_service_1.emailService.sendOTPEmail(contactEmail, otp, sanitizedPassengers[0].firstName);
                        return res.status(200).json({
                            status: "pending_verification",
                            message: "Verification code sent to email. Please verify to complete booking.",
                            data: {
                                requiresVerification: true,
                                expiresAt,
                            },
                        });
                    }
                    else {
                        // Verify OTP
                        const storedOtp = yield redis_service_1.redisService.get(`otp_${contactEmail}`);
                        if (!storedOtp || storedOtp !== validatedData.verificationCode) {
                            throw new appError_1.AppError("Invalid or expired verification code", 400);
                        }
                        // Delete OTP after successful verification
                        yield redis_service_1.redisService.del(`otp_${contactEmail}`);
                    }
                }
                // Verify if the flight offer is still valid
                const flightOfferId = validatedData.flightOfferId;
                const verifiedOffer = yield redis_service_1.redisService.get(`verified_flight_offer_${flightOfferId}`);
                if (!verifiedOffer) {
                    throw new appError_1.AppError("Flight offer expired. Please verify the offer again.", 400);
                }
                // Call Amadeus to create the flight order
                const orderResult = yield amadeus_service_1.amadeusService.createFlightOrder(verifiedOffer, // Cast to any as a workaround for type issue
                sanitizedPassengers);
                // Create booking in our database
                const booking = yield booking_service_1.bookingService.createBooking(((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || null, // Can be null for guest bookings
                flightOfferId, verifiedOffer, // Cast to any as a workaround for type issue
                sanitizedPassengers, parseFloat(((_b = verifiedOffer.price) === null || _b === void 0 ? void 0 : _b.total) || "0"), ((_c = verifiedOffer.price) === null || _c === void 0 ? void 0 : _c.currency) || "USD");
                // Update the booking with Amadeus order ID
                yield booking_service_1.bookingService.updateBookingWithAmadeusOrder(booking.id, orderResult.id, orderResult);
                // For guest users, we might want to create a temporary account
                let guestUser = null;
                if (!isAuthenticated) {
                    guestUser = yield auth_service_1.authService.createGuestAccount(contactEmail);
                    // Link the booking to the guest user
                    if (guestUser && guestUser.id) {
                        yield booking_service_1.bookingService.updateBookingUser(booking.id, guestUser.id);
                    }
                    // Send welcome email with login instructions
                    yield email_service_1.emailService.sendGuestWelcomeEmail(contactEmail, sanitizedPassengers[0].firstName);
                }
                // Add performance timing header
                const endTime = perf_hooks_1.performance.now();
                res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);
                // Return response
                res.status(201).json({
                    status: "success",
                    message: "Flight booked successfully.",
                    data: {
                        booking: {
                            id: booking.id,
                            bookingReference: booking.bookingReference,
                            status: booking.status,
                            totalAmount: booking.totalAmount,
                            currency: booking.currency,
                        },
                        amadeusOrder: {
                            id: orderResult.id,
                            status: orderResult.status,
                        },
                        guestAccount: guestUser
                            ? {
                                email: guestUser.email,
                                message: "A temporary account has been created. Check your email for details.",
                            }
                            : null,
                    },
                });
            }
            catch (error) {
                logger_1.logger.error("Flight booking error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    userId: ((_d = req.user) === null || _d === void 0 ? void 0 : _d.id) || "guest",
                    flightOfferId: req.body.flightOfferId,
                });
                // Handle specific Amadeus booking errors
                if (error instanceof appError_1.AppError) {
                    if (error.message.includes("SEATS_UNAVAILABLE")) {
                        return next(new appError_1.AppError("Seats are no longer available for this flight. Please choose another flight.", 409));
                    }
                    if (error.message.includes("PRICE_CHANGED")) {
                        return next(new appError_1.AppError("The price for this flight has changed. Please verify the offer again.", 409));
                    }
                }
                next(error);
            }
        });
    },
    /**
     * Search for cheapest flight dates for flexible travelers
     * @route GET /api/flights/dates
     * @access Public
     */
    searchFlightDates(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate request query
                const validatedData = (0, validator_1.validateRequest)(req.query, flightSearchDateSchema);
                // Sanitize input data
                const originCode = (0, security_1.sanitizeInput)(validatedData.origin);
                const destinationCode = (0, security_1.sanitizeInput)(validatedData.destination);
                const currencyCode = validatedData.currencyCode
                    ? (0, security_1.sanitizeInput)(validatedData.currencyCode)
                    : "GHS";
                // Check if we're using departureDate or duration
                let departureDate = null;
                let duration = null;
                if (validatedData.departureDate) {
                    departureDate = (0, security_1.sanitizeInput)(validatedData.departureDate);
                }
                else if (validatedData.duration) {
                    duration = validatedData.duration;
                }
                // Prevent self-referential searches
                if (originCode === destinationCode) {
                    throw new appError_1.AppError("Origin and destination cannot be the same", 400);
                }
                // Search for cheapest dates based on provided parameters
                let cheapestDates;
                if (departureDate) {
                    // Use departureDate approach
                    cheapestDates = yield flight_service_1.flightService.searchFlightDatesByDate(originCode, destinationCode, departureDate, currencyCode);
                }
                else {
                    // Use duration approach
                    cheapestDates = yield flight_service_1.flightService.searchFlightDatesByDuration(originCode, destinationCode, duration || 7, // Default to 7 days if null
                    currencyCode);
                }
                // Add cache headers
                res.set("Cache-Control", "private, max-age=3600"); // 1 hour cache
                // Return response
                res.status(200).json({
                    status: "success",
                    data: cheapestDates,
                });
            }
            catch (error) {
                logger_1.logger.error("Flight dates search error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    query: req.query,
                });
                next(error);
            }
        });
    },
    /**
     * Search for flight offers with multi-criteria
     * @route POST /api/flights/advanced-search
     * @access Public
     */
    advancedFlightSearch(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { tripType, originLocationCode, destinationLocationCode, departureDate, returnDate, adults, children, infants, travelClass, originDestinations: rawOriginDestinations, currency = "GHS", // Default to GHS as requested
                sortBy = "price", // Default sort by price
                 } = req.body;
                // Validate input
                if (!tripType) {
                    throw new appError_1.AppError("Trip type is required", 400);
                }
                if (tripType === "multi-city") {
                    // Multi-city validation
                    let formattedOriginDestinations = [];
                    // Convert originDestinations from object to array if needed and extract dates directly from original request
                    const rawOD = req.body.originDestinations;
                    if (rawOD) {
                        const keys = Object.keys(rawOD);
                        // Process each segment directly from the source
                        for (const key of keys) {
                            const segment = rawOD[key];
                            // Validate required fields
                            if (!segment.originLocationCode ||
                                !segment.destinationLocationCode ||
                                !segment.departureDate) {
                                throw new appError_1.AppError(`Missing required fields in segment ${parseInt(key) + 1}`, 400);
                            }
                            // Validate date format
                            if (!segment.departureDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                throw new appError_1.AppError(`Invalid date format in segment ${parseInt(key) + 1}. Must be YYYY-MM-DD`, 400);
                            }
                            // Create properly structured segment with all required fields
                            formattedOriginDestinations.push({
                                id: `${parseInt(key) + 1}`,
                                originLocationCode: segment.originLocationCode,
                                destinationLocationCode: segment.destinationLocationCode,
                                departureDateTimeRange: {
                                    date: segment.departureDate,
                                },
                            });
                        }
                    }
                    // Add extra validation before sending
                    formattedOriginDestinations.forEach((od, index) => {
                        // Double check date is present
                        if (!od.departureDateTimeRange || !od.departureDateTimeRange.date) {
                            throw new appError_1.AppError(`Missing date for segment ${index + 1}. Each segment must have a valid date.`, 400);
                        }
                        // Ensure date format is correct
                        if (!od.departureDateTimeRange.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            throw new appError_1.AppError(`Invalid date format for segment ${index + 1}. Date must be in YYYY-MM-DD format.`, 400);
                        }
                    });
                    // Create search criteria
                    const searchCriteria = {
                        currencyCode: currency,
                    };
                    if (travelClass) {
                        searchCriteria.cabinRestrictions = [
                            {
                                cabin: travelClass,
                                coverage: "MOST_SEGMENTS",
                                originDestinationIds: formattedOriginDestinations.map((_, index) => `${index + 1}`),
                            },
                        ];
                    }
                    // Log the formatted data for debugging
                    logger_1.logger.info("Searching multi-city flights with formatted data", {
                        formattedOriginDestinations: JSON.stringify(formattedOriginDestinations),
                        travelers: {
                            adults: adults || 1,
                            children: children || 0,
                            infants: infants || 0,
                        },
                        travelClass,
                        currency,
                    });
                    // Create travelers array based on counts
                    const travelers = [];
                    // Add adults
                    for (let i = 0; i < (adults || 1); i++) {
                        travelers.push({
                            id: `${i + 1}`,
                            travelerType: "ADULT",
                        });
                    }
                    // Add children if any
                    if (children && children > 0) {
                        for (let i = 0; i < children; i++) {
                            travelers.push({
                                id: `${(adults || 1) + i + 1}`,
                                travelerType: "CHILD",
                            });
                        }
                    }
                    // Add infants if any
                    if (infants && infants > 0) {
                        for (let i = 0; i < infants; i++) {
                            travelers.push({
                                id: `${(adults || 1) + (children || 0) + i + 1}`,
                                travelerType: "INFANT",
                            });
                        }
                    }
                    // Create payload
                    const payload = {
                        originDestinations: formattedOriginDestinations,
                        travelers,
                        sources: ["GDS"],
                        searchCriteria,
                    };
                    try {
                        // Log the entire payload
                        logger_1.logger.info("Final multi-city search payload", {
                            payloadSummary: {
                                originDestinations: payload.originDestinations.length,
                                travelers: payload.travelers.length,
                                currency: searchCriteria.currencyCode,
                                cabin: travelClass || "ECONOMY",
                            },
                        });
                        // Search multi-city flights with the complete payload
                        const results = yield flight_service_1.flightService.searchMultiCityFlightOffers(payload.originDestinations, adults || 1, children || 0, infants || 0, travelClass, currency // Pass currency directly
                        );
                        // Sort results based on user preference
                        if (results && Array.isArray(results)) {
                            sortFlightResults(results, sortBy);
                        }
                        return res.status(200).json({
                            status: "success",
                            data: results,
                        });
                    }
                    catch (multiCityError) {
                        logger_1.logger.error("Error searching multi-city flights", multiCityError);
                        next(multiCityError);
                    }
                }
                else {
                    // One-way or round-trip validation
                    if (!originLocationCode || !destinationLocationCode || !departureDate) {
                        throw new appError_1.AppError("Origin, destination, and departure date are required", 400);
                    }
                    if (tripType === "round-trip" && !returnDate) {
                        throw new appError_1.AppError("Return date is required for round-trip flights", 400);
                    }
                    // Search one-way or round-trip flights
                    const results = yield flight_service_1.flightService.searchFlightOffers(originLocationCode, destinationLocationCode, departureDate, tripType === "round-trip" ? returnDate : undefined, adults || 1, children || 0, infants || 0, travelClass, 20, // Default max results
                    currency // Pass currency directly
                    );
                    // Sort results based on user preference
                    if (results && Array.isArray(results)) {
                        sortFlightResults(results, sortBy);
                    }
                    return res.status(200).json({
                        status: "success",
                        data: results,
                    });
                }
            }
            catch (error) {
                logger_1.logger.error("Error searching flights", error);
                next(error);
            }
        });
    },
    /**
     * Price flight offer
     * @route POST /api/flights/price
     * @access Public
     */
    priceFlightOffer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { flightOffers: rawFlightOffers, currency, currencyCode, } = req.body;
                if (!rawFlightOffers) {
                    throw new appError_1.AppError("Flight offer is required", 400);
                }
                // Import the helper function to fix array structure
                const { fixArrayStructure } = yield Promise.resolve().then(() => __importStar(require("../utils/helpers")));
                // Fix the structure of the flight offers data
                const fixedFlightOffers = fixArrayStructure(rawFlightOffers, "priceFlightOffer");
                // Support both currency naming conventions (currency and currencyCode)
                const useCurrency = currencyCode || currency || "GHS";
                // Check if incoming data has the circular structure issue
                const isRawDataStructure = typeof rawFlightOffers === "object" &&
                    !Array.isArray(rawFlightOffers) &&
                    Object.keys(rawFlightOffers).some((key) => !isNaN(parseInt(key)));
                // Log what type of structure we received
                logger_1.logger.info("Flight offers data structure:", {
                    type: typeof rawFlightOffers,
                    isArray: Array.isArray(rawFlightOffers),
                    hasNumericKeys: isRawDataStructure,
                    keys: Object.keys(rawFlightOffers).slice(0, 3), // Just log a sample of keys
                });
                // Validate flight dates before sending to Amadeus
                const flightOfferArray = Array.isArray(fixedFlightOffers)
                    ? fixedFlightOffers
                    : [fixedFlightOffers];
                // Use current system date for validation
                const now = new Date();
                const currentYear = now.getFullYear();
                // Calculate maximum allowed date (11 months from now)
                const maxFutureDate = new Date(now);
                maxFutureDate.setMonth(maxFutureDate.getMonth() + 11);
                // Set a reasonable maximum year as an additional safety check
                const maxAllowedYear = Math.min(currentYear + 1, 2025);
                logger_1.logger.info("Date validation parameters:", {
                    currentDate: now.toISOString(),
                    maxAllowedDate: maxFutureDate.toISOString(),
                    maxAllowedYear,
                });
                for (const offer of flightOfferArray) {
                    if (!offer.itineraries || !Array.isArray(offer.itineraries)) {
                        throw new appError_1.AppError("Invalid flight offer structure: missing itineraries", 400);
                    }
                    for (const itinerary of offer.itineraries) {
                        if (!itinerary.segments || !Array.isArray(itinerary.segments)) {
                            throw new appError_1.AppError("Invalid flight offer structure: missing segments", 400);
                        }
                        for (const segment of itinerary.segments) {
                            if (!segment.departure || !segment.departure.at) {
                                throw new appError_1.AppError("Invalid segment: missing departure date", 400);
                            }
                            const departureDate = new Date(segment.departure.at);
                            // Check if date is valid
                            if (isNaN(departureDate.getTime())) {
                                throw new appError_1.AppError(`Invalid departure date format: ${segment.departure.at}`, 400);
                            }
                            // Check if date is in the past
                            if (departureDate < now) {
                                logger_1.logger.error("Flight date is in the past:", {
                                    flightDate: segment.departure.at,
                                    currentDate: now.toISOString(),
                                });
                                throw new appError_1.AppError("Flight date is in the past", 400);
                            }
                            // Check if date is too far in the future
                            if (departureDate > maxFutureDate) {
                                logger_1.logger.error("Flight date is too far in future:", {
                                    flightDate: segment.departure.at,
                                    maxAllowedDate: maxFutureDate.toISOString(),
                                });
                                throw new appError_1.AppError("Flight date is too far in the future (maximum 11 months ahead)", 400);
                            }
                            // Special check for dates with years too far in the future
                            const departureYear = departureDate.getFullYear();
                            if (departureYear > maxAllowedYear) {
                                logger_1.logger.error("Flight date year exceeds maximum:", {
                                    flightDate: segment.departure.at,
                                    departureYear,
                                    maxAllowedYear,
                                });
                                throw new appError_1.AppError(`Flight date year ${departureYear} is invalid. Maximum supported year is ${maxAllowedYear}`, 400);
                            }
                        }
                    }
                }
                // Get pricing from Amadeus with the currency code directly
                const pricingResponse = yield flight_service_1.flightService.priceFlightOffers({
                    flightOffers: fixedFlightOffers, // Use the fixed structure
                    currencyCode: useCurrency,
                });
                return res.status(200).json({
                    status: "success",
                    data: pricingResponse,
                });
            }
            catch (error) {
                logger_1.logger.error("Error pricing flight offers", error);
                next(error);
            }
        });
    },
    /**
     * Create flight booking
     * @route POST /api/flights/booking
     * @access Private
     */
    createBooking(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { flightOffer, travelers, contact } = req.body;
                // Validate input
                if (!flightOffer) {
                    throw new appError_1.AppError("Flight offer is required", 400);
                }
                if (!travelers || !Array.isArray(travelers) || travelers.length === 0) {
                    throw new appError_1.AppError("Traveler information is required", 400);
                }
                if (!contact || !contact.emailAddress || !contact.phones) {
                    throw new appError_1.AppError("Contact information is required", 400);
                }
                // Log the request body for debugging
                logger_1.logger.info("Received booking request", {
                    flightOfferId: flightOffer.id,
                    travelersCount: travelers.length,
                    contactEmail: contact.emailAddress,
                    userId: ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || "guest",
                });
                // Import the helper function
                const { fixArrayStructure } = yield Promise.resolve().then(() => __importStar(require("../utils/helpers")));
                // Apply array fix to each component of the request
                const normalizedFlightOffer = fixArrayStructure(flightOffer, "createBooking-flightOffer");
                const normalizedTravelers = fixArrayStructure(travelers, "createBooking-travelers");
                const normalizedContact = fixArrayStructure(contact, "createBooking-contact");
                // Create booking with fixed data structures
                const bookingResponse = yield flight_service_1.flightService.createFlightBooking(normalizedFlightOffer, normalizedTravelers, normalizedContact);
                return res.status(200).json({
                    status: "success",
                    data: bookingResponse,
                });
            }
            catch (error) {
                logger_1.logger.error("Error creating flight booking", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    stack: error instanceof Error ? error.stack : undefined,
                    request: {
                        method: req.method,
                        path: req.path,
                        query: req.query,
                        body: req.body,
                        headers: Object.assign(Object.assign({}, req.headers), { authorization: "[REDACTED]", cookie: "[REDACTED]" }),
                    },
                });
                // Provide a more helpful error message based on the error
                if (error instanceof Error &&
                    error.message.includes("validatingAirlineCodes")) {
                    return next(new appError_1.AppError("The flight offer is missing required airline information. Please try again with a valid flight offer.", 400));
                }
                if (error instanceof Error &&
                    error.message.includes("travelerPricings")) {
                    return next(new appError_1.AppError("The flight offer is missing required passenger pricing information. Please try again with a valid flight offer.", 400));
                }
                next(error);
            }
        });
    },
    /**
     * Analyze flight price to determine if it's a good deal
     * @route GET /api/flights/analyze-price
     * @access Public
     */
    analyzeFlightPrice(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Support both GET (query params) and POST (body)
                const requestData = req.method === "GET" ? req.query : req.body;
                // Validate request data
                const validatedData = (0, validator_1.validateRequest)(requestData, priceAnalysisSchema);
                // Sanitize input data
                const originIataCode = (0, security_1.sanitizeInput)(validatedData.originIataCode);
                const destinationIataCode = (0, security_1.sanitizeInput)(validatedData.destinationIataCode);
                const departureDate = (0, security_1.sanitizeInput)(validatedData.departureDate);
                const returnDate = validatedData.returnDate
                    ? (0, security_1.sanitizeInput)(validatedData.returnDate)
                    : undefined;
                const currencyCode = validatedData.currencyCode
                    ? (0, security_1.sanitizeInput)(validatedData.currencyCode)
                    : "GHS";
                const oneWay = validatedData.oneWay !== undefined ? validatedData.oneWay : false;
                // Prevent self-referential searches
                if (originIataCode === destinationIataCode) {
                    throw new appError_1.AppError("Origin and destination cannot be the same", 400);
                }
                // Analyze flight price
                const priceAnalysis = yield amadeus_service_1.amadeusService.analyzeFlightPrice(originIataCode || "", // Provide default empty string if undefined
                destinationIataCode || "", // Provide default empty string if undefined
                departureDate, returnDate, oneWay === null ? false : !!oneWay, currencyCode);
                logger_1.logger.info("Flight price analysis result", {
                    origin: originIataCode,
                    destination: destinationIataCode,
                    hasData: !!priceAnalysis,
                    dataType: priceAnalysis ? typeof priceAnalysis : "undefined",
                });
                // Add cache headers
                res.set("Cache-Control", "private, max-age=3600"); // 1 hour cache
                // Return response
                res.status(200).json({
                    status: "success",
                    data: priceAnalysis,
                });
            }
            catch (error) {
                logger_1.logger.error("Flight price analysis error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    query: req.query,
                });
                next(error);
            }
        });
    },
    /**
     * Search for flight availabilities with detailed seat information
     * @route POST /api/flights/availabilities
     * @access Public
     */
    searchFlightAvailabilities(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { originDestinations, travelers, sources = ["GDS"] } = req.body;
                // Validate input
                if (!originDestinations ||
                    !Array.isArray(originDestinations) ||
                    originDestinations.length === 0) {
                    throw new appError_1.AppError("At least one origin-destination pair is required", 400);
                }
                // Validate each origin-destination pair
                for (let i = 0; i < originDestinations.length; i++) {
                    const od = originDestinations[i];
                    if (!od.originLocationCode ||
                        !od.destinationLocationCode ||
                        !od.departureDateTime ||
                        !od.departureDateTime.date) {
                        throw new appError_1.AppError(`Origin, destination, and departure date are required for segment ${i + 1}`, 400);
                    }
                    // Ensure id is set (default to position if not provided)
                    if (!od.id) {
                        od.id = `${i + 1}`;
                    }
                }
                // Validate travelers
                if (!travelers || !Array.isArray(travelers) || travelers.length === 0) {
                    throw new appError_1.AppError("At least one traveler is required", 400);
                }
                // Ensure each traveler has an id and valid type
                const validTravelerTypes = [
                    "ADULT",
                    "CHILD",
                    "INFANT",
                    "HELD_INFANT",
                    "SEATED_INFANT",
                    "SENIOR",
                ];
                for (let i = 0; i < travelers.length; i++) {
                    const traveler = travelers[i];
                    if (!traveler.id) {
                        traveler.id = `${i + 1}`;
                    }
                    if (!traveler.travelerType ||
                        !validTravelerTypes.includes(traveler.travelerType)) {
                        throw new appError_1.AppError(`Invalid traveler type for traveler ${i + 1}. Must be one of: ${validTravelerTypes.join(", ")}`, 400);
                    }
                }
                // Search flight availabilities
                const availabilityResults = yield flight_service_1.flightService.searchFlightAvailabilities(originDestinations, travelers, sources);
                return res.status(200).json({
                    status: "success",
                    data: availabilityResults,
                });
            }
            catch (error) {
                logger_1.logger.error("Error searching flight availabilities", error);
                next(error);
            }
        });
    },
};
/**
 * Helper function to sort flight results based on user preference
 * @param flightOffers Array of flight offers
 * @param sortBy Sort criteria (price, duration, stops)
 */
function sortFlightResults(flightOffers, sortBy = "price") {
    if (!Array.isArray(flightOffers))
        return;
    switch (sortBy.toLowerCase()) {
        case "price":
            // Sort by price (lowest first)
            flightOffers.sort((a, b) => {
                var _a, _b;
                const priceA = parseFloat(((_a = a.price) === null || _a === void 0 ? void 0 : _a.total) || 0);
                const priceB = parseFloat(((_b = b.price) === null || _b === void 0 ? void 0 : _b.total) || 0);
                return priceA - priceB;
            });
            break;
        case "duration":
            // Sort by duration (shortest first)
            flightOffers.sort((a, b) => {
                // For multiple itineraries (round-trip), calculate total duration
                const durationA = a.itineraries.reduce((total, itinerary) => {
                    return total + getMinutesFromDuration(itinerary.duration);
                }, 0);
                const durationB = b.itineraries.reduce((total, itinerary) => {
                    return total + getMinutesFromDuration(itinerary.duration);
                }, 0);
                return durationA - durationB;
            });
            break;
        case "stops":
            // Sort by number of stops (fewest first)
            flightOffers.sort((a, b) => {
                const stopsA = a.itineraries.reduce((total, itinerary) => {
                    return total + (itinerary.segments.length - 1);
                }, 0);
                const stopsB = b.itineraries.reduce((total, itinerary) => {
                    return total + (itinerary.segments.length - 1);
                }, 0);
                return stopsA - stopsB;
            });
            break;
        default:
            // Default to price sorting
            flightOffers.sort((a, b) => {
                var _a, _b;
                const priceA = parseFloat(((_a = a.price) === null || _a === void 0 ? void 0 : _a.total) || 0);
                const priceB = parseFloat(((_b = b.price) === null || _b === void 0 ? void 0 : _b.total) || 0);
                return priceA - priceB;
            });
    }
}
/**
 * Helper function to convert duration string (PT2H30M) to minutes
 * @param duration Duration string in ISO8601 format
 * @returns Duration in minutes
 */
function getMinutesFromDuration(duration) {
    if (!duration)
        return 0;
    let minutes = 0;
    // Extract hours
    const hoursMatch = duration.match(/(\d+)H/);
    if (hoursMatch) {
        minutes += parseInt(hoursMatch[1]) * 60;
    }
    // Extract minutes
    const minutesMatch = duration.match(/(\d+)M/);
    if (minutesMatch) {
        minutes += parseInt(minutesMatch[1]);
    }
    return minutes;
}
//# sourceMappingURL=flight.controller.js.map