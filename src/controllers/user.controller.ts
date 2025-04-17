import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../utils/appError";
import { validateRequest } from "../utils/validator";
import { z } from "zod";
import { logger } from "../utils/logger";
import { bookingService } from "../services/booking.service";

const prisma = new PrismaClient();

export const userController = {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      // User is already attached to req by the protect middleware
      const user = req.user;

      // Return response
      res.status(200).json({
        status: "success",
        data: {
          user: {
            id: user!.id,
            email: user!.email,
            name: user!.name,
            phone: user!.phone,
            isEmailVerified: user!.isEmailVerified,
            isPhoneVerified: user!.isPhoneVerified,
            role: user!.role,
            createdAt: user!.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get user profile with their bookings
   */
  async getProfileWithBookings(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.id;

      // Get user
      const user = req.user;

      // Get recent bookings for the user (limit to 5)
      const allBookings = await bookingService.getUserBookings(userId);

      // Get recent bookings (pending or confirmed)
      const recentBookings = allBookings
        .filter((booking) => ["PENDING", "CONFIRMED"].includes(booking.status))
        .slice(0, 5); // Limit to 5 recent bookings

      // Return response
      res.status(200).json({
        status: "success",
        data: {
          user: {
            id: user!.id,
            email: user!.email,
            name: user!.name,
            phone: user!.phone,
            isEmailVerified: user!.isEmailVerified,
            isPhoneVerified: user!.isPhoneVerified,
            role: user!.role,
            createdAt: user!.createdAt,
          },
          recentBookings,
          bookingsCount: {
            total: allBookings.length,
            pending: allBookings.filter((b) => b.status === "PENDING").length,
            confirmed: allBookings.filter((b) => b.status === "CONFIRMED")
              .length,
            completed: allBookings.filter((b) => b.status === "COMPLETED")
              .length,
            cancelled: allBookings.filter((b) => b.status === "CANCELLED")
              .length,
          },
        },
      });
    } catch (error) {
      logger.error("Error fetching profile with bookings", error);
      next(error);
    }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const schema = z.object({
        name: z
          .string()
          .min(2, "Name must be at least 2 characters")
          .optional(),
        phone: z.string().optional(),
      });

      const validatedData = validateRequest(req.body, schema);

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          name: validatedData.name,
          phone: validatedData.phone,
        },
      });

      logger.info(`User profile updated: ${updatedUser.id}`);

      // Return response
      res.status(200).json({
        status: "success",
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            phone: updatedUser.phone,
            isEmailVerified: updatedUser.isEmailVerified,
            isPhoneVerified: updatedUser.isPhoneVerified,
            role: updatedUser.role,
            createdAt: updatedUser.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get user's bookings (both recent and past)
   */
  async getUserBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      // Get all bookings for the user
      const allBookings = await bookingService.getUserBookings(userId);

      // Separate bookings into recent and past
      const now = new Date();

      // Recent bookings: those that are PENDING, CONFIRMED, or have future travel dates
      const recentBookings = allBookings.filter((booking) => {
        const isPendingOrConfirmed = ["PENDING", "CONFIRMED"].includes(
          booking.status
        );

        // Check if the booking has future travel dates
        // This is a simplified check - we would need to parse the flight offer data
        // to properly check departure dates
        const hasFutureTravelDates = booking.expiresAt
          ? booking.expiresAt > now
          : false;

        return isPendingOrConfirmed || hasFutureTravelDates;
      });

      // Past bookings: those that are COMPLETED, CANCELLED, or have past travel dates
      const pastBookings = allBookings.filter((booking) => {
        return !recentBookings.includes(booking);
      });

      res.status(200).json({
        status: "success",
        data: {
          recentBookings,
          pastBookings,
        },
      });
    } catch (error) {
      logger.error("Error fetching user bookings", error);
      next(error);
    }
  },

  /**
   * Delete user account
   */
  async deleteAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      // Validate request body to confirm deletion
      const schema = z.object({
        confirmation: z.literal("DELETE_MY_ACCOUNT"),
      });

      const validatedData = validateRequest(req.body, schema);

      // Log the deletion request
      logger.info(`Account deletion request: ${userId}`);

      // Get user's bookings to check if there are active ones
      const bookings = await bookingService.getUserBookings(userId);
      const hasActiveBookings = bookings.some(
        (b) =>
          b.status === "CONFIRMED" && (!b.expiresAt || b.expiresAt > new Date())
      );

      if (hasActiveBookings) {
        throw new AppError(
          "Cannot delete account with active bookings. Please cancel all active bookings first.",
          400
        );
      }

      // Delete user
      await prisma.user.delete({
        where: { id: userId },
      });

      // Clear user's session
      res.clearCookie("jwt");

      res.status(200).json({
        status: "success",
        message: "Your account has been successfully deleted",
      });
    } catch (error) {
      logger.error("Error deleting user account", error);
      next(error);
    }
  },
};
