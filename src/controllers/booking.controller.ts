import { Request, Response, NextFunction } from "express";
import { bookingService } from "../services/booking.service";
import { AppError } from "../utils/appError";
import { validateRequest } from "../utils/validator";
import { z } from "zod";
import { logger } from "../utils/logger";
import { sanitizeInput } from "../utils/security";
import { performance } from "perf_hooks";
import { BookingStatus, FlightOffer, PassengerDetail } from "../types";

// Schema definitions - placed outside functions for better reuse and performance
const createBookingSchema = z.object({
  flightOfferId: z.string().min(1, "Flight offer ID is required"),
  flightOfferData: z.custom<FlightOffer>(),
  passengerDetails: z
    .array(
      z.object({
        id: z.string().min(1, "Passenger ID is required"),
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
        email: z.string().email("Invalid email address").optional(),
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
  totalAmount: z.number().positive("Total amount must be positive"),
  currency: z
    .string()
    .length(3, "Currency code must be 3 characters")
    .optional(),
});

const bookingIdSchema = z.object({
  id: z.string().uuid("Invalid booking ID format"),
});

const bookingReferenceSchema = z.object({
  reference: z
    .string()
    .min(8, "Booking reference must be at least 8 characters"),
});

export const bookingController = {
  /**
   * Create a new booking
   */
  async createBooking(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = performance.now();

    try {
      logger.info("Booking creation request", {
        userId: req.user?.id,
        ip: req.ip,
      });

      // Validate request body
      const validatedData = validateRequest(req.body, createBookingSchema);

      // Sanitize passenger details
      const sanitizedPassengers = validatedData.passengerDetails.map(
        (passenger) => ({
          ...passenger,
          firstName: sanitizeInput(passenger.firstName),
          lastName: sanitizeInput(passenger.lastName),
          email: passenger.email ? sanitizeInput(passenger.email) : undefined,
          documentNumber: passenger.documentNumber
            ? sanitizeInput(passenger.documentNumber)
            : undefined,
        })
      );

      // Create booking
      const booking = await bookingService.createBooking(
        req.user!.id,
        validatedData.flightOfferId,
        validatedData.flightOfferData,
        sanitizedPassengers,
        validatedData.totalAmount,
        validatedData.currency
      );

      // Add performance timing header
      const endTime = performance.now();
      res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);

      // Return response
      return void res.status(201).json({
        status: "success",
        data: {
          booking: {
            id: booking.id,
            bookingReference: booking.bookingReference,
            status: booking.status,
            totalAmount: booking.totalAmount,
            currency: booking.currency,
            createdAt: booking.createdAt,
          },
        },
      });
    } catch (error) {
      logger.error("Booking creation error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.id,
      });
      return void next(error);
    }
  },

  /**
   * Get a booking by ID
   */
  async getBooking(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = performance.now();

    try {
      // Validate request params
      const validatedData = validateRequest(req.params, bookingIdSchema);

      // Get booking
      const booking = await bookingService.getBookingById(validatedData.id);

      // Check if booking belongs to user
      if (booking.userId !== req.user!.id && req.user!.role !== "ADMIN") {
        return void next(
          new AppError("You do not have permission to access this booking", 403)
        );
      }

      // Add performance timing header
      const endTime = performance.now();
      res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);

      // Set ETag for caching
      res.set(
        "ETag",
        `W/"booking-${booking.id}-${booking.updatedAt.getTime()}"`
      );

      // Return response
      return void res.status(200).json({
        status: "success",
        data: {
          booking,
        },
      });
    } catch (error) {
      logger.error("Get booking error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.id,
        bookingId: req.params.id,
      });
      next(error);
    }
  },

  /**
   * Get a booking by reference number
   */
  async getBookingByReference(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = performance.now();

    try {
      // Validate request params
      const validatedData = validateRequest(req.params, bookingReferenceSchema);

      // Sanitize reference
      const sanitizedReference = sanitizeInput(validatedData.reference);

      // Get booking
      const booking =
        await bookingService.getBookingByReference(sanitizedReference);

      // Check if booking belongs to user
      if (booking.userId !== req.user!.id && req.user!.role !== "ADMIN") {
        return void next(
          new AppError("You do not have permission to access this booking", 403)
        );
      }

      // Add performance timing header
      const endTime = performance.now();
      res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);

      // Set ETag for caching
      res.set(
        "ETag",
        `W/"booking-ref-${booking.bookingReference}-${booking.updatedAt.getTime()}"`
      );

      // Return response
      return void res.status(200).json({
        status: "success",
        data: {
          booking,
        },
      });
    } catch (error) {
      logger.error("Get booking by reference error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.id,
        reference: req.params.reference,
      });
      next(error);
    }
  },

  /**
   * Get all bookings for the current user
   */
  async getUserBookings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = performance.now();

    try {
      // Get user bookings
      const bookings = await bookingService.getUserBookings(req.user!.id);

      // Add performance timing header
      const endTime = performance.now();
      res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);

      // Return response
      return void res.status(200).json({
        status: "success",
        results: bookings.length,
        data: {
          bookings,
        },
      });
    } catch (error) {
      logger.error("Get user bookings error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.id,
      });
      next(error);
    }
  },

  /**
   * Cancel a booking
   */
  async cancelBooking(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = performance.now();

    try {
      // Validate request params
      const validatedData = validateRequest(req.params, bookingIdSchema);

      // Get booking first to check permission
      const booking = await bookingService.getBookingById(validatedData.id);

      // Check if booking belongs to user
      if (booking.userId !== req.user!.id && req.user!.role !== "ADMIN") {
        return void next(
          new AppError("You do not have permission to cancel this booking", 403)
        );
      }

      // Check if booking is already cancelled or completed
      if (booking.status === "CANCELLED") {
        return void next(
          new AppError("This booking is already cancelled", 400)
        );
      }

      if (booking.status === "COMPLETED") {
        return void next(
          new AppError("Completed bookings cannot be cancelled", 400)
        );
      }

      // Cancel booking
      const cancelledBooking = await bookingService.cancelBooking(
        validatedData.id
      );

      // Add performance timing header
      const endTime = performance.now();
      res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);

      // Return response
      return void res.status(200).json({
        status: "success",
        data: {
          booking: cancelledBooking,
        },
      });
    } catch (error) {
      logger.error("Cancel booking error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.id,
        bookingId: req.params.id,
      });
      next(error);
    }
  },

  /**
   * Generate an e-ticket for a confirmed booking
   */
  async generateETicket(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = performance.now();

    try {
      // Validate request params
      const validatedData = validateRequest(req.params, bookingIdSchema);

      // Get booking first to check permission
      const booking = await bookingService.getBookingById(validatedData.id);

      // Check if booking belongs to user
      if (booking.userId !== req.user!.id && req.user!.role !== "ADMIN") {
        return void next(
          new AppError("You do not have permission to access this booking", 403)
        );
      }

      // Generate e-ticket
      const eTicketUrl = await bookingService.generateETicket(validatedData.id);

      // Add performance timing header
      const endTime = performance.now();
      res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);

      // Return response
      return void res.status(200).json({
        status: "success",
        data: {
          eTicketUrl,
        },
      });
    } catch (error) {
      logger.error("Generate e-ticket error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.id,
        bookingId: req.params.id,
      });
      next(error);
    }
  },

  /**
   * Confirm a booking with Amadeus (admin or system use)
   */
  async confirmBookingWithAmadeus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = performance.now();

    try {
      // Validate request params
      const validatedData = validateRequest(req.params, bookingIdSchema);

      // Only admin can use this endpoint
      if (req.user!.role !== "ADMIN") {
        return void next(
          new AppError("You do not have permission to perform this action", 403)
        );
      }

      // Confirm booking with Amadeus
      const confirmedBooking = await bookingService.confirmBookingWithAmadeus(
        validatedData.id
      );

      // Add performance timing header
      const endTime = performance.now();
      res.set("X-Response-Time", `${Math.round(endTime - startTime)}ms`);

      // Return response
      return void res.status(200).json({
        status: "success",
        data: {
          booking: confirmedBooking,
        },
      });
    } catch (error) {
      logger.error("Confirm booking error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.id,
        bookingId: req.params.id,
      });
      next(error);
    }
  },

  /**
   * Create a flight booking
   * @route POST /api/bookings/flights
   * @access Private
   */
  async createFlightBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const { flightOffer, travelers, contact } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      // Validate request body
      if (!flightOffer) {
        throw new AppError("Flight offer is required", 400);
      }

      if (!travelers || !Array.isArray(travelers) || travelers.length === 0) {
        throw new AppError("Traveler information is required", 400);
      }

      if (!contact || !contact.emailAddress || !contact.phones) {
        throw new AppError("Contact information is required", 400);
      }

      // Create booking
      const bookingResult = await bookingService.createFlightBooking(
        userId,
        flightOffer,
        travelers,
        contact
      );

      return res.status(201).json({
        status: "success",
        message: "Flight booking created successfully",
        data: bookingResult,
      });
    } catch (error) {
      logger.error("Error creating flight booking", error);
      next(error);
    }
  },

  /**
   * Get user's flight bookings
   * @route GET /api/bookings/flights
   * @access Private
   */
  async getUserFlightBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const bookings = await bookingService.getUserFlightBookings(userId);

      return res.status(200).json({
        status: "success",
        data: { bookings },
      });
    } catch (error) {
      logger.error("Error getting user flight bookings", error);
      next(error);
    }
  },

  /**
   * Get flight booking details
   * @route GET /api/bookings/flights/:id
   * @access Private
   */
  async getFlightBookingDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const booking = await bookingService.getFlightBookingDetails(id, userId);

      return res.status(200).json({
        status: "success",
        data: { booking },
      });
    } catch (error) {
      logger.error("Error getting flight booking details", error);
      next(error);
    }
  },
};
