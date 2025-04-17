import {
  PrismaClient,
} from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import NodeCache from "node-cache";
import { amadeusService } from "./amadeus.service";
import { emailService } from "./email.service";
import { AppError } from "../utils/appError";
import { logger } from "../utils/logger";
import { performance } from "perf_hooks";
import type { Booking, BookingCreateParams, FlightOffer, PassengerDetail } from "../types/booking";
import { asPrismaBooking } from "../types/booking";
import { BookingStatus, PaymentStatus } from "../types/enums";
import { flightService } from "./flight.service";

const prisma = new PrismaClient();

// Booking cache for frequently accessed bookings
const bookingCache = new NodeCache({
  stdTTL: 600, // 10 minutes cache
  checkperiod: 120,
  useClones: false,
});

export const bookingService = {
  /**
   * Update booking with Amadeus order information
   * @param bookingId The booking ID
   * @param amadeusOrderId Amadeus order ID
   * @param amadeusOrderData Amadeus order data
   * @returns Updated booking
   */
  async updateBookingWithAmadeusOrder(
    bookingId: string,
    amadeusOrderId: string,
    amadeusOrderData: any
  ): Promise<Booking> {
    logger.info(`Updating booking with Amadeus order: ${bookingId}`);

    // Invalidate cache since we're changing the booking
    bookingCache.del(`booking_${bookingId}`);

    // Get the booking first to get the reference for cache invalidation
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (booking) {
      bookingCache.del(`booking_ref_${booking.bookingReference}`);
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        amadeusOrderId,
        amadeusOrderData,
      },
    });

    return asPrismaBooking(updatedBooking);
  },

  /**
   * Update booking with guest user ID after guest account creation
   * @param bookingId The booking ID
   * @param userId The user ID to associate
   * @returns Updated booking
   */
  async updateBookingUser(bookingId: string, userId: string): Promise<Booking> {
    logger.info(`Updating booking with user: ${bookingId}, ${userId}`);

    // Invalidate cache
    bookingCache.del(`booking_${bookingId}`);

    // Get the booking first to get the reference for cache invalidation
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (booking) {
      bookingCache.del(`booking_ref_${booking.bookingReference}`);
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { userId },
    });

    // Update cache with new booking data
    const typedBooking = asPrismaBooking(updatedBooking);
    bookingCache.set(`booking_${bookingId}`, typedBooking);
    bookingCache.set(
      `booking_ref_${updatedBooking.bookingReference}`,
      typedBooking
    );

    return typedBooking;
  },
  /**
   * Create a new booking
   */
  async createBooking(
    userId: string | null,
    flightOfferId: string,
    flightOfferData: any,
    passengerDetails: any[],
    totalAmount: number,
    currency: string = "USD"
  ): Promise<Booking> {
    const startTime = performance.now();

    // Generate booking reference
    const bookingReference = `JT${Math.floor(100000 + Math.random() * 900000)}`;

    // Set expiration time (offer valid for 1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Determine contact email from passenger details or primary passenger
    const contactEmail = passengerDetails[0].email;
    const contactPhone = passengerDetails[0].phone;

    logger.info(`Creating booking for ${userId ? `user ${userId}` : "guest"}`, {
      flightOfferId,
      bookingReference,
      totalAmount,
      currency,
      contactEmail,
    });

    try {
      // Create booking in database
      const booking = await prisma.booking.create({
        data: {
          bookingReference,
          userId, // Can be null for guest bookings
          flightOfferData,
          passengerDetails,
          contactEmail,
          contactPhone,
          totalAmount,
          currency,
          status: "PENDING",
          expiresAt,
        },
      });

      // Send booking confirmation email
      try {
        await emailService.sendBookingConfirmationEmail(
          contactEmail,
          bookingReference,
          flightOfferData,
          passengerDetails,
          totalAmount,
          currency
        );
      } catch (error) {
        logger.error("Failed to send booking confirmation email", error);
        // Don't throw error here, as the booking was created successfully
      }

      // Add to cache
      const typedBooking = asPrismaBooking(booking);
      bookingCache.set(`booking_${booking.id}`, typedBooking);
      bookingCache.set(`booking_ref_${bookingReference}`, typedBooking);

      // Log performance
      const duration = performance.now() - startTime;
      logger.debug(`Booking creation completed in ${duration}ms`, {
        bookingId: booking.id,
        responseTime: duration,
      });

      return typedBooking;
    } catch (error) {
      logger.error("Booking creation error", error);
      throw new AppError(
        error instanceof AppError ? error.message : "Failed to create booking",
        error instanceof AppError ? error.statusCode : 500
      );
    }
  },

  /**
   * Get a booking by ID
   */
  async getBookingById(bookingId: string): Promise<Booking> {
    // Check cache first
    const cachedBooking = bookingCache.get<Booking>(`booking_${bookingId}`);
    if (cachedBooking) {
      logger.info(`Retrieved booking from cache: ${bookingId}`);
      return cachedBooking;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    // Cache the result
    const typedBooking = asPrismaBooking(booking);
    bookingCache.set(`booking_${bookingId}`, typedBooking);

    return typedBooking;
  },

  /**
   * Get a booking by reference
   */
  async getBookingByReference(bookingReference: string): Promise<Booking> {
    // Check cache first
    const cachedBooking = bookingCache.get<Booking>(
      `booking_ref_${bookingReference}`
    );
    if (cachedBooking) {
      logger.info(
        `Retrieved booking from cache by reference: ${bookingReference}`
      );
      return cachedBooking;
    }

    const booking = await prisma.booking.findUnique({
      where: { bookingReference },
    });

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    // Cache the result
    const typedBooking = asPrismaBooking(booking);
    bookingCache.set(`booking_ref_${bookingReference}`, typedBooking);
    bookingCache.set(`booking_${booking.id}`, typedBooking);

    return typedBooking;
  },

  /**
   * Get all bookings for a user
   */
  async getUserBookings(userId: string): Promise<Booking[]> {
    // This endpoint might be too dynamic to cache effectively
    // But we can add database-level optimizations
    const bookings = await prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    
    return bookings.map((booking: any) => asPrismaBooking(booking));
  },

  /**
   * Update booking status
   */
  async updateBookingStatus(
    bookingId: string,
    status: BookingStatus
  ): Promise<Booking> {
    logger.info(`Updating booking status: ${bookingId} to ${status}`);

    // Invalidate cache since we're changing the booking
    bookingCache.del(`booking_${bookingId}`);

    // Get the booking first to get the reference for cache invalidation
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (booking) {
      bookingCache.del(`booking_ref_${booking.bookingReference}`);
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: status as any }, // Cast to any to work around Prisma enum type issues
    });

    // Update cache with new booking data
    const typedBooking = asPrismaBooking(updatedBooking);
    bookingCache.set(`booking_${bookingId}`, typedBooking);
    bookingCache.set(
      `booking_ref_${updatedBooking.bookingReference}`,
      typedBooking
    );

    return typedBooking;
  },

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    if (booking.status === "CANCELLED") {
      throw new AppError("Booking is already cancelled", 400);
    }

    // In a real application, you would implement cancellation logic with the airline
    // and handle refunds if applicable
    logger.info(`Cancelling booking: ${bookingId}`);

    // Invalidate cache
    bookingCache.del(`booking_${bookingId}`);
    bookingCache.del(`booking_ref_${booking.bookingReference}`);

    const cancelledBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED" },
    });

    try {
      // Get user email for notification
      const user = await prisma.user.findUnique({
        where: { id: booking.userId || undefined },
      });

      if (user) {
        // Send cancellation email
        await emailService.sendBookingCancellationEmail(
          user.email,
          booking.bookingReference
        );
      }
    } catch (error) {
      logger.error("Failed to send booking cancellation email", error);
      // Don't throw error here, as the booking was cancelled successfully
    }

    // Update cache with new booking data
    const typedBooking = asPrismaBooking(cancelledBooking);
    bookingCache.set(`booking_${bookingId}`, typedBooking);
    bookingCache.set(
      `booking_ref_${cancelledBooking.bookingReference}`,
      typedBooking
    );

    return typedBooking;
  },

  /**
   * Generate e-ticket for a booking
   */
  async generateETicket(bookingId: string): Promise<string> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    if (booking.status !== "CONFIRMED") {
      throw new AppError(
        "Cannot generate e-ticket for unconfirmed booking",
        400
      );
    }

    // If e-ticket already exists, return it
    if (booking.eTicketUrl) {
      return booking.eTicketUrl;
    }

    logger.info(`Generating e-ticket for booking: ${bookingId}`);

    // In a real application, you would generate a PDF e-ticket
    // and store it in a cloud storage service

    // For now, we'll just generate a fake URL
    const eTicketUrl = `https://joshtravels.com/e-tickets/${booking.bookingReference}.pdf`;

    // Update booking with e-ticket URL
    await prisma.booking.update({
      where: { id: bookingId },
      data: { eTicketUrl },
    });

    // Invalidate cache since we've updated the booking
    bookingCache.del(`booking_${bookingId}`);
    bookingCache.del(`booking_ref_${booking.bookingReference}`);

    return eTicketUrl;
  },

  /**
   * Create a flight booking
   * @param userId User ID
   * @param flightOffer Flight offer
   * @param travelers Traveler information
   * @param contact Contact information
   * @returns Booking information
   */
  async createFlightBooking(
    userId: string,
    flightOffer: any,
    travelers: any[],
    contact: any
  ): Promise<any> {
    try {
      // 1. Validate the flight offer (price verification)
      const pricingResponse =
        await flightService.priceFlightOffers(flightOffer);

      // Check if price has changed
      const currentPrice = pricingResponse.data.flightOffers[0].price.total;
      const originalPrice = flightOffer.price.total;

      if (currentPrice !== originalPrice) {
        throw new AppError(
          `Flight price has changed from ${originalPrice} to ${currentPrice}. Please confirm the new price.`,
          400
        );
      }

      // 2. Create booking with Amadeus
      const bookingResponse = await flightService.createFlightBooking(
        flightOffer,
        travelers,
        contact
      );

      const bookingReference =
        bookingResponse.data.associatedRecords[0].reference;

      // 3. Store booking details in database
      const booking = await prisma.flightBooking.create({
        data: {
          userId,
          bookingReference,
          flightOfferData: flightOffer,
          totalPrice: parseFloat(currentPrice),
          currency: flightOffer.price.currency,
          bookingStatus: "CONFIRMED" as any, // Cast to any to work around Prisma enum type issues
          paymentStatus: "COMPLETED" as any, // Cast to any to work around Prisma enum type issues
          contactEmail: contact.emailAddress,
          contactPhone: contact.phones[0].number,
          passengers: travelers,
        },
      });

      // 4. Send confirmation email
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (user) {
        await emailService.sendFlightBookingConfirmation(
          user.email,
          user.name || "Traveler",
          bookingReference,
          flightOffer
        );
      }

      logger.info(
        `Flight booking created: ${bookingReference} for user ${userId}`
      );

      return {
        booking,
        amadeus: bookingResponse.data,
      };
    } catch (error: any) {
      logger.error("Error creating flight booking", error);

      // If Amadeus booking was created but database storage failed,
      // we should log this for manual reconciliation
      if (error.bookingReference) {
        logger.error(
          `Booking created in Amadeus but failed to store in database: ${error.bookingReference}`
        );
      }

      throw error;
    }
  },

  /**
   * Get user's flight bookings
   * @param userId User ID
   * @returns List of bookings
   */
  async getUserFlightBookings(userId: string): Promise<any[]> {
    return prisma.flightBooking.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Get flight booking details
   * @param bookingId Booking ID
   * @param userId User ID
   * @returns Booking details
   */
  async getFlightBookingDetails(
    bookingId: string,
    userId: string
  ): Promise<any> {
    const booking = await prisma.flightBooking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
    });

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    return booking;
  },

  /**
   * Confirm booking with Amadeus
   */
  async confirmBookingWithAmadeus(bookingId: string): Promise<Booking> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: true },
    });

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    if (booking.status !== "PENDING") {
      throw new AppError("Booking is not in pending status", 400);
    }

    logger.info(`Confirming booking with Amadeus: ${bookingId}`);

    try {
      // Format travelers for Amadeus API
      const travelers = Array.isArray(booking.passengerDetails)
        ? booking.passengerDetails.map((passenger: any) => ({
            id: passenger.id,
            dateOfBirth: passenger.dateOfBirth,
            name: {
              firstName: passenger.firstName,
              lastName: passenger.lastName,
            },
            gender: passenger.gender,
            contact: {
              emailAddress:
                passenger.email || (booking.user ? booking.user.email : ""),
              phones: passenger.phone
                ? [
                    {
                      deviceType: "MOBILE",
                      number: passenger.phone,
                    },
                  ]
                : undefined,
            },
            documents: passenger.documentType
              ? [
                  {
                    documentType: passenger.documentType,
                    number: passenger.documentNumber,
                    issuanceCountry: passenger.documentIssuingCountry,
                    expiryDate: passenger.documentExpiryDate,
                  },
                ]
              : undefined,
          }))
        : [];

      // Create flight order with Amadeus
      const order = await amadeusService.createFlightOrder(
        booking.flightOfferData as any,
        travelers
      );

      // Update booking status and add order details
      const confirmedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "CONFIRMED",
          amadeusOrderId: order.id,
          amadeusOrderData: order,
        },
      });

      // Invalidate cache
      bookingCache.del(`booking_${bookingId}`);
      bookingCache.del(`booking_ref_${booking.bookingReference}`);

      // Send confirmation email
      if (booking.user) {
        await emailService.sendBookingConfirmationEmail(
          booking.user.email,
          booking.bookingReference,
          booking.flightOfferData as any,
          Array.isArray(booking.passengerDetails)
            ? booking.passengerDetails
            : [],
          booking.totalAmount,
          booking.currency
        );
      }

      return asPrismaBooking(confirmedBooking);
    } catch (error) {
      logger.error("Failed to confirm booking with Amadeus", error);

      // Update booking status to failed
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "FAILED",
          failureReason:
            error instanceof Error ? error.message : "Unknown error",
        },
      });

      // Invalidate cache
      bookingCache.del(`booking_${bookingId}`);
      bookingCache.del(`booking_ref_${booking.bookingReference}`);

      throw new AppError("Failed to confirm booking with Amadeus", 500, {
        originalError: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  /**
   * Clear booking cache - useful for testing
   */
  clearCache(): void {
    bookingCache.flushAll();
    logger.info("Booking cache cleared");
  },
};
