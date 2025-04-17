import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { AppError } from "../utils/appError";
import { flightService } from "../services/flight.service";

// Define the segment interface
interface FormattedSegment {
  id: string;
  originLocationCode: string;
  destinationLocationCode: string;
  departureDateTimeRange: {
    date: string;
  };
}

/**
 * Search for multi-city flights
 * This is a dedicated controller to handle the multi-city flight search
 * to avoid issues with the originDestinations format
 */
export const searchMultiCityFlights = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      adults = 1,
      children = 0,
      infants = 0,
      travelClass = "ECONOMY",
      currency = "GHS",
      originDestinations,
      sortBy = "price",
    } = req.body;

    logger.info("Multi-city search request received", {
      hasOriginDestinations: !!originDestinations,
      odType: typeof originDestinations,
      adults,
      children,
      infants,
      currency,
    });

    // Validate
    if (!originDestinations) {
      throw new AppError(
        "originDestinations is required for multi-city search",
        400
      );
    }

    // Process originDestinations
    const formattedSegments: FormattedSegment[] = [];

    // Handle both object and array formats
    if (Array.isArray(originDestinations)) {
      // Handle array format
      if (originDestinations.length < 2) {
        throw new AppError(
          "At least 2 segments are required for multi-city search",
          400
        );
      }

      originDestinations.forEach((segment, index) => {
        validateAndAddSegment(segment, index, formattedSegments);
      });
    } else if (typeof originDestinations === "object") {
      // Handle object format (with numeric keys)
      const keys = Object.keys(originDestinations);
      if (keys.length < 2) {
        throw new AppError(
          "At least 2 segments are required for multi-city search",
          400
        );
      }

      keys.forEach((key) => {
        const segment = originDestinations[key];
        validateAndAddSegment(segment, parseInt(key), formattedSegments);
      });
    } else {
      throw new AppError("Invalid originDestinations format", 400);
    }

    // Log the processed segments
    logger.info("Processed segments for multi-city search", {
      count: formattedSegments.length,
      segments: formattedSegments.map(
        (s) =>
          `${s.id}: ${s.originLocationCode}-${s.destinationLocationCode} on ${s.departureDateTimeRange.date}`
      ),
    });

    // Search multi-city flights
    const results = await flightService.searchMultiCityFlightOffers(
      formattedSegments,
      adults,
      children,
      infants,
      travelClass,
      currency
    );

    // Return results
    return res.status(200).json({
      status: "success",
      data: results,
    });
  } catch (error) {
    logger.error("Error in multi-city search", error);
    next(error);
  }
};

/**
 * Helper function to validate and add a segment
 */
function validateAndAddSegment(
  segment: any,
  index: number,
  formattedSegments: FormattedSegment[]
) {
  // Validate required fields
  if (
    !segment.originLocationCode ||
    !segment.destinationLocationCode ||
    !segment.departureDate
  ) {
    throw new AppError(
      `Missing required fields in segment ${index + 1}. Needs originLocationCode, destinationLocationCode and departureDate.`,
      400
    );
  }

  // Validate date format
  if (!segment.departureDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new AppError(
      `Invalid date format in segment ${index + 1}. Must be YYYY-MM-DD`,
      400
    );
  }

  // Add formatted segment
  formattedSegments.push({
    id: `${index + 1}`,
    originLocationCode: segment.originLocationCode,
    destinationLocationCode: segment.destinationLocationCode,
    departureDateTimeRange: {
      date: segment.departureDate,
    },
  });
}
