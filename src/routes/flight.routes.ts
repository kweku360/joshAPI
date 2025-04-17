import express from "express";
import { flightController } from "../controllers/flight.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { searchMultiCityFlights } from "../controllers/multi-city.controller";
import { fixArrayStructureMiddleware } from "../middleware/fixArrays.middleware";

const router = express.Router();

// Public routes
router.get("/locations", flightController.searchLocations);
router.post("/search", flightController.searchFlights);
router.post(
  "/price",
  fixArrayStructureMiddleware,
  flightController.priceFlightOffer
);

// Add route for advanced search (multi-city, etc.)
router.post(
  "/advanced-search",
  fixArrayStructureMiddleware,
  flightController.advancedFlightSearch
);

// Add dedicated route for multi-city search
router.post("/multi-city", fixArrayStructureMiddleware, searchMultiCityFlights);

// Add route for cheapest flight dates
router.get("/dates", flightController.searchFlightDates);

// Add route for price analysis
router.get("/analyze-price", flightController.analyzeFlightPrice);

// Add route for flight availabilities
router.post(
  "/availabilities",
  fixArrayStructureMiddleware,
  flightController.searchFlightAvailabilities
);

// Protected routes (require authentication)
router.post(
  "/booking",
  authMiddleware.protect,
  fixArrayStructureMiddleware,
  flightController.createBooking
);

export default router;
