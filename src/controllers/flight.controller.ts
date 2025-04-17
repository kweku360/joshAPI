import { Request, Response, NextFunction } from "express";
import { amadeusService } from "../services/amadeus.service";
import { authService } from "../services/auth.service";
import { bookingService } from "../services/booking.service";
import { emailService } from "../services/email.service";
import { redisService } from "../services/redis.service";
import { AppError } from "../utils/appError";
import { validateRequest } from "../utils/validator";
import { z } from "zod";
import { logger } from "../utils/logger";
import { sanitizeInput } from "../utils/security";
import { performance } from "perf_hooks";
import { FlightSearchParams, FlightOffer, Location } from "../types";
import { flightService } from "../services/flight.service";

// Schema definitions - moved outside function for reuse and performance
const flightSearchSchema = z
  .object({
    origin: z
      .string()
      .min(3, "Origin must be at least 3 characters")
      .max(3, "Airport code must be exactly 3 characters")
      .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Origin must be a valid 3-letter IATA code (uppercase)",
      })
      .optional(),
    originLocationCode: z
      .string()
      .min(3, "Origin must be at least 3 characters")
      .max(3, "Airport code must be exactly 3 characters")
      .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Origin must be a valid 3-letter IATA code (uppercase)",
      })
      .optional(),
    destination: z
      .string()
      .min(3, "Destination must be at least 3 characters")
      .max(3, "Airport code must be exactly 3 characters")
      .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Destination must be a valid 3-letter IATA code (uppercase)",
      })
      .optional(),
    destinationLocationCode: z
      .string()
      .min(3, "Destination must be at least 3 characters")
      .max(3, "Airport code must be exactly 3 characters")
      .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Destination must be a valid 3-letter IATA code (uppercase)",
      })
      .optional(),
    departureDate: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Departure date must be in YYYY-MM-DD format"
      )
      .refine(
        (val) => {
          const date = new Date(val);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return date >= today;
        },
        {
          message: "Departure date must be today or in the future",
        }
      ),
    returnDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Return date must be in YYYY-MM-DD format")
      .refine(
        (val) => {
          const date = new Date(val);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return date >= today;
        },
        {
          message: "Return date must be today or in the future",
        }
      )
      .optional(),
    adults: z.coerce
      .number()
      .int()
      .min(1, "At least 1 adult is required")
      .max(9, "Maximum 9 adults allowed"),
    children: z.coerce
      .number()
      .int()
      .min(0)
      .max(9, "Maximum 9 children allowed")
      .optional(),
    infants: z.coerce
      .number()
      .int()
      .min(0)
      .max(9, "Maximum 9 infants allowed")
      .optional(),
    travelClass: z
      .enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"])
      .optional(),
    currencyCode: z
      .string()
      .length(3, "Currency code must be exactly 3 characters")
      .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Currency code must be a valid 3-letter code (uppercase)",
      })
      .optional(),
    currency: z
      .string()
      .length(3, "Currency code must be exactly 3 characters")
      .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Currency code must be a valid 3-letter code (uppercase)",
      })
      .optional(),
    maxPrice: z.coerce.number().positive("Price must be positive").optional(),
    max: z.coerce
      .number()
      .int()
      .positive()
      .max(100, "Maximum 100 results allowed")
      .optional(),
    includedAirlineCodes: z
      .string()
      .refine((val) => /^[A-Z0-9]{2}(,[A-Z0-9]{2})*$/.test(val), {
        message: "Airline codes must be comma-separated 2-letter codes",
      })
      .optional(),
    nonStop: z.preprocess(
      (val) => val === "true" || val === true,
      z.boolean().optional()
    ),
    oneWay: z.preprocess(
      (val) => val === "true" || val === true,
      z.boolean().optional()
    ),
    tripType: z.enum(["one-way", "round-trip", "multi-city"]).optional(),
  })
  .superRefine((data, ctx) => {
    // Require either origin or originLocationCode
    if (!data.origin && !data.originLocationCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either origin or originLocationCode is required",
        path: ["origin"],
      });
    }

    // Require either destination or destinationLocationCode
    if (!data.destination && !data.destinationLocationCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either destination or destinationLocationCode is required",
        path: ["destination"],
      });
    }
  });

const flightPriceSchema = z.object({
  flightOffers: z
    .array(z.any())
    .min(1, "At least one flight offer is required"),
});

const airportSearchSchema = z.object({
  keyword: z.string().min(2, "Keyword must be at least 2 characters"),
});

const locationSearchSchema = z.object({
  keyword: z.string().min(2, "Keyword must be at least 2 characters"),
  countryCode: z
    .string()
    .length(2, "Country code must be exactly 2 characters")
    .refine((val) => /^[A-Z]{2}$/.test(val), {
      message: "Country code must be a valid 2-letter ISO code (uppercase)",
    })
    .optional(),
});

// Additional schemas for new endpoints
const flightOfferIdSchema = z.object({
  offerId: z.string().min(1, "Flight offer ID is required"),
});

const bookFlightSchema = z.object({
  flightOfferId: z.string().min(1, "Flight offer ID is required"),
  flightOfferData: z.any(),
  passengerDetails: z
    .array(
      z.object({
        firstName: z
          .string()
          .min(2, "First name must be at least 2 characters"),
        lastName: z.string().min(2, "Last name must be at least 2 characters"),
        dateOfBirth: z
          .string()
          .regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "Date of birth must be in YYYY-MM-DD format"
          ),
        gender: z.enum(["MALE", "FEMALE", "UNSPECIFIED"]).optional(),
        email: z.string().email("Invalid email address"),
        phone: z.string().optional(),
        documentType: z.enum(["PASSPORT", "ID_CARD", "VISA"]).optional(),
        documentNumber: z.string().optional(),
        documentIssuingCountry: z
          .string()
          .length(2, "Country code must be 2 characters")
          .optional(),
        documentExpiryDate: z
          .string()
          .regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "Expiry date must be in YYYY-MM-DD format"
          )
          .optional(),
      })
    )
    .min(1, "At least one passenger is required"),
  contactEmail: z.string().email("Invalid contact email address"),
  contactPhone: z.string().optional(),
  verificationCode: z.string().optional(), // OTP verification code if required
});

const flightSearchDateSchema = z
  .object({
    origin: z
      .string()
      .min(3, "Origin must be at least 3 characters")
      .max(3, "Airport code must be exactly 3 characters")
      .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Origin must be a valid 3-letter IATA code (uppercase)",
      }),
    destination: z
      .string()
      .min(3, "Destination must be at least 3 characters")
      .max(3, "Airport code must be exactly 3 characters")
      .refine((val) => /^[A-Z]{3}$/.test(val), {
        message: "Destination must be a valid 3-letter IATA code (uppercase)",
      }),
    departureDate: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Departure date must be in YYYY-MM-DD format"
      )
      .optional(),
    duration: z.coerce
      .number()
      .int()
      .positive("Duration must be a positive integer")
      .optional(),
    currencyCode: z
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
const priceAnalysisSchema = z.object({
  originIataCode: z
    .string()
    .length(3, "Origin must be exactly 3 characters")
    .refine((val) => /^[A-Z]{3}$/.test(val), {
      message: "Origin must be a valid 3-letter IATA code (uppercase)",
    }),
  destinationIataCode: z
    .string()
    .length(3, "Destination must be exactly 3 characters")
    .refine((val) => /^[A-Z]{3}$/.test(val), {
      message: "Destination must be a valid 3-letter IATA code (uppercase)",
    }),
  departureDate: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "Departure date must be in YYYY-MM-DD format"
    ),
  returnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Return date must be in YYYY-MM-DD format")
    .optional(),
  currencyCode: z
    .string()
    .length(3, "Currency code must be exactly 3 characters")
    .refine((val) => /^[A-Z]{3}$/.test(val), {
      message: "Currency code must be a valid 3-letter code (uppercase)",
    })
    .optional(),
  oneWay: z.preprocess(
    (val) => val === "true" || val === true,
    z.boolean().optional()
  ),
});

export const flightController = {
  /**
   * Search for flights based on criteria
   */
  async searchFlights(req: Request, res: Response, next: NextFunction) {
    const startTime = performance.now();

    try {
      logger.info("Flight search request", {
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
      const destinationIataCode =
        data.destinationLocationCode || data.destination;
      const currencyCode = data.currencyCode || data.currency || "GHS";

      // Check if origin and destination are the same
      if (originIataCode === destinationIataCode) {
        return res.status(400).json({
          status: "error",
          message: "Origin and destination cannot be the same",
        });
      }

      const tripType =
        data.tripType ||
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

        const flightOffers = await flightService.searchFlightOffers(
          originIataCode || "",
          destinationIataCode || "",
          data.departureDate,
          !isOneWay ? data.returnDate : undefined,
          adults,
          children,
          infants,
          travelClass,
          max,
          currencyCode
        );

        return res.status(200).json({
          status: "success",
          currency: currencyCode,
          data: {
            flightOffers,
          },
        });
      } else if (tripType === "multi-city") {
        return res.status(400).json({
          status: "error",
          message:
            "For multi-city trips, please use the advanced flight search endpoint",
        });
      } else {
        return res.status(400).json({
          status: "error",
          message: "Invalid trip type specified",
        });
      }
    } catch (error) {
      logger.error("Error searching for flights", {
        query: req.query,
        body: req.body,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({
        status: "error",
        message: "An error occurred while searching for flights",
      });
    }
  },

  /**
   * Search for locations (airports and cities) by keyword
   * @route GET /api/flights/locations
   * @access Public
   * @example GET /api/flights/locations?keyword=MUC&countryCode=DE
   */
  async searchLocations(req: Request, res: Response, next: NextFunction) {
    const startTime = performance.now();

    try {
      // Log the request
      logger.info("Location search request", {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        query: req.query,
      });

      // Validate request query
      const validatedData = validateRequest(
        req.query as Record<string, string>,
        locationSearchSchema
      );

      // Sanitize keyword input
      const keyword = sanitizeInput(validatedData.keyword);
      const countryCode = validatedData.countryCode
        ? sanitizeInput(validatedData.countryCode)
        : undefined;

      // Search locations using the Amadeus service
      const locations = await amadeusService.searchLocations(
        keyword,
        countryCode
      );

      // Add cache headers - location data changes less frequently
      res.set("Cache-Control", "public, max-age=86400"); // 24 hour cache
      res.set("ETag", `W/"location-${keyword}-${countryCode || "all"}"`);

      // Add performance timing header
      const endTime = performance.now();
      res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);

      // Return response - format matches Amadeus API structure
      res.status(200).json({
        status: "success",
        results: locations.length,
        data: {
          locations,
        },
      });
    } catch (error) {
      logger.error("Location search error", {
        error: error instanceof Error ? error.message : "Unknown error",
        query: req.query,
      });
      next(error);
    }
  },

  /**
   * Get pricing for selected flight offers
   */
  async getFlightPrice(req: Request, res: Response, next: NextFunction) {
    const startTime = performance.now();

    try {
      logger.info("Flight price request", {
        ip: req.ip,
        userId: req.user?.id,
      });

      // Validate request body
      const validatedData = validateRequest(req.body, flightPriceSchema);

      // Get flight price
      const flightPrice = await amadeusService.getFlightPrice(
        validatedData.flightOffers
      );

      // Add performance timing header
      const endTime = performance.now();
      res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);

      // Return response
      res.status(200).json({
        status: "success",
        data: {
          flightPrice,
        },
      });
    } catch (error) {
      logger.error("Flight price error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      next(error);
    }
  },

  /**
   * Search for airports and cities by keyword
   */
  async searchAirports(req: Request, res: Response, next: NextFunction) {
    const startTime = performance.now();

    try {
      // Validate request query
      const validatedData = validateRequest(
        req.query as Record<string, string>,
        airportSearchSchema
      );

      // Sanitize keyword input
      const keyword = sanitizeInput(validatedData.keyword);

      // Search airports
      const airports = await amadeusService.searchAirports(keyword);

      // Add cache headers - airport data changes less frequently
      res.set("Cache-Control", "public, max-age=86400"); // 24 hour cache

      // Add performance timing header
      const endTime = performance.now();
      res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);

      // Return response
      res.status(200).json({
        status: "success",
        results: airports.length,
        data: {
          airports,
        },
      });
    } catch (error) {
      logger.error("Airport search error", {
        error: error instanceof Error ? error.message : "Unknown error",
        query: req.query,
      });
      next(error);
    }
  },

  /**
   * Verify a flight offer is still valid and get updated pricing
   */
  async verifyFlightOffer(req: Request, res: Response, next: NextFunction) {
    const startTime = performance.now();

    try {
      // Validate request params
      const validatedParams = validateRequest(req.params, flightOfferIdSchema);

      // Get the offer from cache or database
      // In a real implementation, you would retrieve the specific flight offer
      const offerId = sanitizeInput(validatedParams.offerId);

      logger.info(`Verifying flight offer: ${offerId}`, {
        userId: req.user?.id || "guest",
        ip: req.ip,
      });

      // Retrieve the original offer from the request body or cache
      const flightOffers =
        req.body.flightOffers ||
        (await redisService.get(`flight_offer_${offerId}`));

      if (!flightOffers) {
        throw new AppError("Flight offer not found or expired", 404);
      }

      // Verify with Amadeus
      const verifiedOffer = await amadeusService.getFlightPrice([flightOffers]);

      // Check for price changes or availability changes
      const originalPrice = flightOffers.price?.total;
      const newPrice = verifiedOffer.flightOffers[0]?.price?.total;

      // Price change or availability check
      let priceChanged = false;
      let seatsAvailable = true;

      if (originalPrice !== newPrice) {
        priceChanged = true;
      }

      if (verifiedOffer.flightOffers[0]?.numberOfBookableSeats < 1) {
        seatsAvailable = false;
      }

      // Set a short expiration time for verified offers (10 minutes)
      await redisService.set(
        `verified_flight_offer_${offerId}`,
        verifiedOffer.flightOffers[0],
        600
      );

      // Add performance timing header
      const endTime = performance.now();
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
    } catch (error) {
      logger.error("Flight offer verification error", {
        error: error instanceof Error ? error.message : "Unknown error",
        offerId: req.params.offerId,
      });

      // If it's an Amadeus error about expired offers
      if (error instanceof AppError && error.message.includes("expired")) {
        return next(
          new AppError(
            "This flight offer has expired. Please search again.",
            410
          )
        );
      }

      next(error);
    }
  },

  /**
   * Book a flight with provided passenger details
   * Handles both guest and authenticated users
   */
  async bookFlight(req: Request, res: Response, next: NextFunction) {
    const startTime = performance.now();

    try {
      // Validate request body
      const validatedData = validateRequest(req.body, bookFlightSchema);

      // Sanitize passenger details
      const sanitizedPassengers = validatedData.passengerDetails.map(
        (passenger, index) => ({
          id: `${index + 1}`, // Amadeus requires numeric IDs as strings
          firstName: sanitizeInput(passenger.firstName),
          lastName: sanitizeInput(passenger.lastName),
          dateOfBirth: passenger.dateOfBirth,
          gender: passenger.gender || "UNSPECIFIED",
          email: sanitizeInput(passenger.email),
          phone: passenger.phone ? sanitizeInput(passenger.phone) : undefined,
          documentType: passenger.documentType,
          documentNumber: passenger.documentNumber
            ? sanitizeInput(passenger.documentNumber)
            : undefined,
          documentIssuingCountry: passenger.documentIssuingCountry,
          documentExpiryDate: passenger.documentExpiryDate,
        })
      );

      // Check if email verification is needed for guest booking
      const contactEmail = sanitizeInput(validatedData.contactEmail);
      const isAuthenticated = !!req.user;

      if (!isAuthenticated) {
        // For guest booking, verify the email with OTP
        if (!validatedData.verificationCode) {
          // First request - generate OTP and send email
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

          // Save OTP for verification
          await redisService.set(
            `otp_${contactEmail}`,
            otp,
            900 // 15 minutes in seconds
          );

          // Send OTP email
          await emailService.sendOTPEmail(
            contactEmail,
            otp,
            sanitizedPassengers[0].firstName
          );

          return res.status(200).json({
            status: "pending_verification",
            message:
              "Verification code sent to email. Please verify to complete booking.",
            data: {
              requiresVerification: true,
              expiresAt,
            },
          });
        } else {
          // Verify OTP
          const storedOtp = await redisService.get(`otp_${contactEmail}`);

          if (!storedOtp || storedOtp !== validatedData.verificationCode) {
            throw new AppError("Invalid or expired verification code", 400);
          }

          // Delete OTP after successful verification
          await redisService.del(`otp_${contactEmail}`);
        }
      }

      // Verify if the flight offer is still valid
      const flightOfferId = validatedData.flightOfferId;
      const verifiedOffer = await redisService.get(
        `verified_flight_offer_${flightOfferId}`
      );

      if (!verifiedOffer) {
        throw new AppError(
          "Flight offer expired. Please verify the offer again.",
          400
        );
      }

      // Call Amadeus to create the flight order
      const orderResult = await amadeusService.createFlightOrder(
        verifiedOffer as any, // Cast to any as a workaround for type issue
        sanitizedPassengers
      );

      // Create booking in our database
      const booking = await bookingService.createBooking(
        req.user?.id || null, // Can be null for guest bookings
        flightOfferId,
        verifiedOffer as any, // Cast to any as a workaround for type issue
        sanitizedPassengers,
        parseFloat((verifiedOffer as any).price?.total || "0"),
        (verifiedOffer as any).price?.currency || "USD"
      );

      // Update the booking with Amadeus order ID
      await bookingService.updateBookingWithAmadeusOrder(
        booking.id,
        orderResult.id,
        orderResult
      );

      // For guest users, we might want to create a temporary account
      let guestUser: any = null;
      if (!isAuthenticated) {
        guestUser = await authService.createGuestAccount(contactEmail);

        // Link the booking to the guest user
        if (guestUser && guestUser.id) {
          await bookingService.updateBookingUser(booking.id, guestUser.id);
        }

        // Send welcome email with login instructions
        await emailService.sendGuestWelcomeEmail(
          contactEmail,
          sanitizedPassengers[0].firstName
        );
      }

      // Add performance timing header
      const endTime = performance.now();
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
                message:
                  "A temporary account has been created. Check your email for details.",
              }
            : null,
        },
      });
    } catch (error) {
      logger.error("Flight booking error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.id || "guest",
        flightOfferId: req.body.flightOfferId,
      });

      // Handle specific Amadeus booking errors
      if (error instanceof AppError) {
        if (error.message.includes("SEATS_UNAVAILABLE")) {
          return next(
            new AppError(
              "Seats are no longer available for this flight. Please choose another flight.",
              409
            )
          );
        }
        if (error.message.includes("PRICE_CHANGED")) {
          return next(
            new AppError(
              "The price for this flight has changed. Please verify the offer again.",
              409
            )
          );
        }
      }

      next(error);
    }
  },

  /**
   * Search for cheapest flight dates for flexible travelers
   * @route GET /api/flights/dates
   * @access Public
   */
  async searchFlightDates(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request query
      const validatedData = validateRequest(
        req.query as Record<string, string>,
        flightSearchDateSchema
      );

      // Sanitize input data
      const originCode = sanitizeInput(validatedData.origin);
      const destinationCode = sanitizeInput(validatedData.destination);
      const currencyCode = validatedData.currencyCode
        ? sanitizeInput(validatedData.currencyCode)
        : "GHS";

      // Check if we're using departureDate or duration
      let departureDate = null;
      let duration = null;

      if (validatedData.departureDate) {
        departureDate = sanitizeInput(validatedData.departureDate);
      } else if (validatedData.duration) {
        duration = validatedData.duration;
      }

      // Prevent self-referential searches
      if (originCode === destinationCode) {
        throw new AppError("Origin and destination cannot be the same", 400);
      }

      // Search for cheapest dates based on provided parameters
      let cheapestDates;
      if (departureDate) {
        // Use departureDate approach
        cheapestDates = await flightService.searchFlightDatesByDate(
          originCode,
          destinationCode,
          departureDate,
          currencyCode
        );
      } else {
        // Use duration approach
        cheapestDates = await flightService.searchFlightDatesByDuration(
          originCode,
          destinationCode,
          duration || 7, // Default to 7 days if null
          currencyCode
        );
      }

      // Add cache headers
      res.set("Cache-Control", "private, max-age=3600"); // 1 hour cache

      // Return response
      res.status(200).json({
        status: "success",
        data: cheapestDates,
      });
    } catch (error) {
      logger.error("Flight dates search error", {
        error: error instanceof Error ? error.message : "Unknown error",
        query: req.query,
      });
      next(error);
    }
  },

  /**
   * Search for flight offers with multi-criteria
   * @route POST /api/flights/advanced-search
   * @access Public
   */
  async advancedFlightSearch(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        tripType,
        originLocationCode,
        destinationLocationCode,
        departureDate,
        returnDate,
        adults,
        children,
        infants,
        travelClass,
        originDestinations: rawOriginDestinations,
        currency = "GHS", // Default to GHS as requested
        sortBy = "price", // Default sort by price
      } = req.body;

      // Validate input
      if (!tripType) {
        throw new AppError("Trip type is required", 400);
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
            if (
              !segment.originLocationCode ||
              !segment.destinationLocationCode ||
              !segment.departureDate
            ) {
              throw new AppError(
                `Missing required fields in segment ${parseInt(key) + 1}`,
                400
              );
            }

            // Validate date format
            if (!segment.departureDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
              throw new AppError(
                `Invalid date format in segment ${parseInt(key) + 1}. Must be YYYY-MM-DD`,
                400
              );
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
            throw new AppError(
              `Missing date for segment ${index + 1}. Each segment must have a valid date.`,
              400
            );
          }

          // Ensure date format is correct
          if (!od.departureDateTimeRange.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            throw new AppError(
              `Invalid date format for segment ${index + 1}. Date must be in YYYY-MM-DD format.`,
              400
            );
          }
        });

        // Create search criteria
        const searchCriteria: any = {
          currencyCode: currency,
        };

        if (travelClass) {
          searchCriteria.cabinRestrictions = [
            {
              cabin: travelClass,
              coverage: "MOST_SEGMENTS",
              originDestinationIds: formattedOriginDestinations.map(
                (_, index) => `${index + 1}`
              ),
            },
          ];
        }

        // Log the formatted data for debugging
        logger.info("Searching multi-city flights with formatted data", {
          formattedOriginDestinations: JSON.stringify(
            formattedOriginDestinations
          ),
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
          logger.info("Final multi-city search payload", {
            payloadSummary: {
              originDestinations: payload.originDestinations.length,
              travelers: payload.travelers.length,
              currency: searchCriteria.currencyCode,
              cabin: travelClass || "ECONOMY",
            },
          });

          // Search multi-city flights with the complete payload
          const results = await flightService.searchMultiCityFlightOffers(
            payload.originDestinations,
            adults || 1,
            children || 0,
            infants || 0,
            travelClass,
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
        } catch (multiCityError) {
          logger.error("Error searching multi-city flights", multiCityError);
          next(multiCityError);
        }
      } else {
        // One-way or round-trip validation
        if (!originLocationCode || !destinationLocationCode || !departureDate) {
          throw new AppError(
            "Origin, destination, and departure date are required",
            400
          );
        }

        if (tripType === "round-trip" && !returnDate) {
          throw new AppError(
            "Return date is required for round-trip flights",
            400
          );
        }

        // Search one-way or round-trip flights
        const results = await flightService.searchFlightOffers(
          originLocationCode,
          destinationLocationCode,
          departureDate,
          tripType === "round-trip" ? returnDate : undefined,
          adults || 1,
          children || 0,
          infants || 0,
          travelClass,
          20, // Default max results
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
    } catch (error) {
      logger.error("Error searching flights", error);
      next(error);
    }
  },

  /**
   * Price flight offer
   * @route POST /api/flights/price
   * @access Public
   */
  async priceFlightOffer(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        flightOffers: rawFlightOffers,
        currency,
        currencyCode,
      } = req.body;

      if (!rawFlightOffers) {
        throw new AppError("Flight offer is required", 400);
      }

      // Import the helper function to fix array structure
      const { fixArrayStructure } = await import("../utils/helpers");

      // Fix the structure of the flight offers data
      const fixedFlightOffers = fixArrayStructure(
        rawFlightOffers,
        "priceFlightOffer"
      );

      // Support both currency naming conventions (currency and currencyCode)
      const useCurrency = currencyCode || currency || "GHS";

      // Check if incoming data has the circular structure issue
      const isRawDataStructure =
        typeof rawFlightOffers === "object" &&
        !Array.isArray(rawFlightOffers) &&
        Object.keys(rawFlightOffers).some((key) => !isNaN(parseInt(key)));

      // Log what type of structure we received
      logger.info("Flight offers data structure:", {
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

      logger.info("Date validation parameters:", {
        currentDate: now.toISOString(),
        maxAllowedDate: maxFutureDate.toISOString(),
        maxAllowedYear,
      });

      for (const offer of flightOfferArray) {
        if (!offer.itineraries || !Array.isArray(offer.itineraries)) {
          throw new AppError(
            "Invalid flight offer structure: missing itineraries",
            400
          );
        }

        for (const itinerary of offer.itineraries) {
          if (!itinerary.segments || !Array.isArray(itinerary.segments)) {
            throw new AppError(
              "Invalid flight offer structure: missing segments",
              400
            );
          }

          for (const segment of itinerary.segments) {
            if (!segment.departure || !segment.departure.at) {
              throw new AppError(
                "Invalid segment: missing departure date",
                400
              );
            }

            const departureDate = new Date(segment.departure.at);

            // Check if date is valid
            if (isNaN(departureDate.getTime())) {
              throw new AppError(
                `Invalid departure date format: ${segment.departure.at}`,
                400
              );
            }

            // Check if date is in the past
            if (departureDate < now) {
              logger.error("Flight date is in the past:", {
                flightDate: segment.departure.at,
                currentDate: now.toISOString(),
              });
              throw new AppError("Flight date is in the past", 400);
            }

            // Check if date is too far in the future
            if (departureDate > maxFutureDate) {
              logger.error("Flight date is too far in future:", {
                flightDate: segment.departure.at,
                maxAllowedDate: maxFutureDate.toISOString(),
              });
              throw new AppError(
                "Flight date is too far in the future (maximum 11 months ahead)",
                400
              );
            }

            // Special check for dates with years too far in the future
            const departureYear = departureDate.getFullYear();
            if (departureYear > maxAllowedYear) {
              logger.error("Flight date year exceeds maximum:", {
                flightDate: segment.departure.at,
                departureYear,
                maxAllowedYear,
              });
              throw new AppError(
                `Flight date year ${departureYear} is invalid. Maximum supported year is ${maxAllowedYear}`,
                400
              );
            }
          }
        }
      }

      // Get pricing from Amadeus with the currency code directly
      const pricingResponse = await flightService.priceFlightOffers({
        flightOffers: fixedFlightOffers, // Use the fixed structure
        currencyCode: useCurrency,
      });

      return res.status(200).json({
        status: "success",
        data: pricingResponse,
      });
    } catch (error) {
      logger.error("Error pricing flight offers", error);
      next(error);
    }
  },

  /**
   * Create flight booking
   * @route POST /api/flights/booking
   * @access Private
   */
  async createBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const { flightOffer, travelers, contact } = req.body;

      // Validate input
      if (!flightOffer) {
        throw new AppError("Flight offer is required", 400);
      }

      if (!travelers || !Array.isArray(travelers) || travelers.length === 0) {
        throw new AppError("Traveler information is required", 400);
      }

      if (!contact || !contact.emailAddress || !contact.phones) {
        throw new AppError("Contact information is required", 400);
      }

      // Log the request body for debugging
      logger.info("Received booking request", {
        flightOfferId: flightOffer.id,
        travelersCount: travelers.length,
        contactEmail: contact.emailAddress,
        userId: req.user?.id || "guest",
      });

      // Import the helper function
      const { fixArrayStructure } = await import("../utils/helpers");

      // Apply array fix to each component of the request
      const normalizedFlightOffer = fixArrayStructure(
        flightOffer,
        "createBooking-flightOffer"
      );
      const normalizedTravelers = fixArrayStructure(
        travelers,
        "createBooking-travelers"
      );
      const normalizedContact = fixArrayStructure(
        contact,
        "createBooking-contact"
      );

      // Create booking with fixed data structures
      const bookingResponse = await flightService.createFlightBooking(
        normalizedFlightOffer,
        normalizedTravelers,
        normalizedContact
      );

      return res.status(200).json({
        status: "success",
        data: bookingResponse,
      });
    } catch (error) {
      logger.error("Error creating flight booking", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        request: {
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.body,
          headers: {
            ...req.headers,
            authorization: "[REDACTED]",
            cookie: "[REDACTED]",
          },
        },
      });

      // Provide a more helpful error message based on the error
      if (
        error instanceof Error &&
        error.message.includes("validatingAirlineCodes")
      ) {
        return next(
          new AppError(
            "The flight offer is missing required airline information. Please try again with a valid flight offer.",
            400
          )
        );
      }

      if (
        error instanceof Error &&
        error.message.includes("travelerPricings")
      ) {
        return next(
          new AppError(
            "The flight offer is missing required passenger pricing information. Please try again with a valid flight offer.",
            400
          )
        );
      }

      next(error);
    }
  },

  /**
   * Analyze flight price to determine if it's a good deal
   * @route GET /api/flights/analyze-price
   * @access Public
   */
  async analyzeFlightPrice(req: Request, res: Response, next: NextFunction) {
    try {
      // Support both GET (query params) and POST (body)
      const requestData = req.method === "GET" ? req.query : req.body;

      // Validate request data
      const validatedData = validateRequest(
        requestData as unknown as Record<string, unknown>,
        priceAnalysisSchema
      );

      // Sanitize input data
      const originIataCode = sanitizeInput(validatedData.originIataCode);
      const destinationIataCode = sanitizeInput(
        validatedData.destinationIataCode
      );
      const departureDate = sanitizeInput(validatedData.departureDate);
      const returnDate = validatedData.returnDate
        ? sanitizeInput(validatedData.returnDate)
        : undefined;
      const currencyCode = validatedData.currencyCode
        ? sanitizeInput(validatedData.currencyCode)
        : "GHS";
      const oneWay =
        validatedData.oneWay !== undefined ? validatedData.oneWay : false;

      // Prevent self-referential searches
      if (originIataCode === destinationIataCode) {
        throw new AppError("Origin and destination cannot be the same", 400);
      }

      // Analyze flight price
      const priceAnalysis = await amadeusService.analyzeFlightPrice(
        originIataCode || "", // Provide default empty string if undefined
        destinationIataCode || "", // Provide default empty string if undefined
        departureDate,
        returnDate,
        oneWay === null ? false : !!oneWay,
        currencyCode
      );

      logger.info("Flight price analysis result", {
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
    } catch (error) {
      logger.error("Flight price analysis error", {
        error: error instanceof Error ? error.message : "Unknown error",
        query: req.query,
      });
      next(error);
    }
  },

  /**
   * Search for flight availabilities with detailed seat information
   * @route POST /api/flights/availabilities
   * @access Public
   */
  async searchFlightAvailabilities(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { originDestinations, travelers, sources = ["GDS"] } = req.body;

      // Validate input
      if (
        !originDestinations ||
        !Array.isArray(originDestinations) ||
        originDestinations.length === 0
      ) {
        throw new AppError(
          "At least one origin-destination pair is required",
          400
        );
      }

      // Validate each origin-destination pair
      for (let i = 0; i < originDestinations.length; i++) {
        const od = originDestinations[i];
        if (
          !od.originLocationCode ||
          !od.destinationLocationCode ||
          !od.departureDateTime ||
          !od.departureDateTime.date
        ) {
          throw new AppError(
            `Origin, destination, and departure date are required for segment ${i + 1}`,
            400
          );
        }

        // Ensure id is set (default to position if not provided)
        if (!od.id) {
          od.id = `${i + 1}`;
        }
      }

      // Validate travelers
      if (!travelers || !Array.isArray(travelers) || travelers.length === 0) {
        throw new AppError("At least one traveler is required", 400);
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

        if (
          !traveler.travelerType ||
          !validTravelerTypes.includes(traveler.travelerType)
        ) {
          throw new AppError(
            `Invalid traveler type for traveler ${i + 1}. Must be one of: ${validTravelerTypes.join(", ")}`,
            400
          );
        }
      }

      // Search flight availabilities
      const availabilityResults =
        await flightService.searchFlightAvailabilities(
          originDestinations,
          travelers,
          sources
        );

      return res.status(200).json({
        status: "success",
        data: availabilityResults,
      });
    } catch (error) {
      logger.error("Error searching flight availabilities", error);
      next(error);
    }
  },
};

/**
 * Helper function to sort flight results based on user preference
 * @param flightOffers Array of flight offers
 * @param sortBy Sort criteria (price, duration, stops)
 */
function sortFlightResults(
  flightOffers: any[],
  sortBy: string = "price"
): void {
  if (!Array.isArray(flightOffers)) return;

  switch (sortBy.toLowerCase()) {
    case "price":
      // Sort by price (lowest first)
      flightOffers.sort((a, b) => {
        const priceA = parseFloat(a.price?.total || 0);
        const priceB = parseFloat(b.price?.total || 0);
        return priceA - priceB;
      });
      break;

    case "duration":
      // Sort by duration (shortest first)
      flightOffers.sort((a, b) => {
        // For multiple itineraries (round-trip), calculate total duration
        const durationA = a.itineraries.reduce(
          (total: number, itinerary: any) => {
            return total + getMinutesFromDuration(itinerary.duration);
          },
          0
        );

        const durationB = b.itineraries.reduce(
          (total: number, itinerary: any) => {
            return total + getMinutesFromDuration(itinerary.duration);
          },
          0
        );

        return durationA - durationB;
      });
      break;

    case "stops":
      // Sort by number of stops (fewest first)
      flightOffers.sort((a, b) => {
        const stopsA = a.itineraries.reduce((total: number, itinerary: any) => {
          return total + (itinerary.segments.length - 1);
        }, 0);

        const stopsB = b.itineraries.reduce((total: number, itinerary: any) => {
          return total + (itinerary.segments.length - 1);
        }, 0);

        return stopsA - stopsB;
      });
      break;

    default:
      // Default to price sorting
      flightOffers.sort((a, b) => {
        const priceA = parseFloat(a.price?.total || 0);
        const priceB = parseFloat(b.price?.total || 0);
        return priceA - priceB;
      });
  }
}

/**
 * Helper function to convert duration string (PT2H30M) to minutes
 * @param duration Duration string in ISO8601 format
 * @returns Duration in minutes
 */
function getMinutesFromDuration(duration: string): number {
  if (!duration) return 0;

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
