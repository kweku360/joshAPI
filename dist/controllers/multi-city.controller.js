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
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchMultiCityFlights = void 0;
const logger_1 = require("../utils/logger");
const appError_1 = require("../utils/appError");
const flight_service_1 = require("../services/flight.service");
/**
 * Search for multi-city flights
 * This is a dedicated controller to handle the multi-city flight search
 * to avoid issues with the originDestinations format
 */
const searchMultiCityFlights = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { adults = 1, children = 0, infants = 0, travelClass = "ECONOMY", currency = "GHS", originDestinations, sortBy = "price", } = req.body;
        logger_1.logger.info("Multi-city search request received", {
            hasOriginDestinations: !!originDestinations,
            odType: typeof originDestinations,
            adults,
            children,
            infants,
            currency,
        });
        // Validate
        if (!originDestinations) {
            throw new appError_1.AppError("originDestinations is required for multi-city search", 400);
        }
        // Process originDestinations
        const formattedSegments = [];
        // Handle both object and array formats
        if (Array.isArray(originDestinations)) {
            // Handle array format
            if (originDestinations.length < 2) {
                throw new appError_1.AppError("At least 2 segments are required for multi-city search", 400);
            }
            originDestinations.forEach((segment, index) => {
                validateAndAddSegment(segment, index, formattedSegments);
            });
        }
        else if (typeof originDestinations === "object") {
            // Handle object format (with numeric keys)
            const keys = Object.keys(originDestinations);
            if (keys.length < 2) {
                throw new appError_1.AppError("At least 2 segments are required for multi-city search", 400);
            }
            keys.forEach((key) => {
                const segment = originDestinations[key];
                validateAndAddSegment(segment, parseInt(key), formattedSegments);
            });
        }
        else {
            throw new appError_1.AppError("Invalid originDestinations format", 400);
        }
        // Log the processed segments
        logger_1.logger.info("Processed segments for multi-city search", {
            count: formattedSegments.length,
            segments: formattedSegments.map((s) => `${s.id}: ${s.originLocationCode}-${s.destinationLocationCode} on ${s.departureDateTimeRange.date}`),
        });
        // Search multi-city flights
        const results = yield flight_service_1.flightService.searchMultiCityFlightOffers(formattedSegments, adults, children, infants, travelClass, currency);
        // Return results
        return res.status(200).json({
            status: "success",
            data: results,
        });
    }
    catch (error) {
        logger_1.logger.error("Error in multi-city search", error);
        next(error);
    }
});
exports.searchMultiCityFlights = searchMultiCityFlights;
/**
 * Helper function to validate and add a segment
 */
function validateAndAddSegment(segment, index, formattedSegments) {
    // Validate required fields
    if (!segment.originLocationCode ||
        !segment.destinationLocationCode ||
        !segment.departureDate) {
        throw new appError_1.AppError(`Missing required fields in segment ${index + 1}. Needs originLocationCode, destinationLocationCode and departureDate.`, 400);
    }
    // Validate date format
    if (!segment.departureDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        throw new appError_1.AppError(`Invalid date format in segment ${index + 1}. Must be YYYY-MM-DD`, 400);
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
//# sourceMappingURL=multi-city.controller.js.map