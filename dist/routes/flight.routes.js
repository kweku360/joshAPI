"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const flight_controller_1 = require("../controllers/flight.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const multi_city_controller_1 = require("../controllers/multi-city.controller");
const fixArrays_middleware_1 = require("../middleware/fixArrays.middleware");
const router = express_1.default.Router();
// Public routes
router.get("/locations", flight_controller_1.flightController.searchLocations);
router.post("/search", flight_controller_1.flightController.searchFlights);
router.post("/price", fixArrays_middleware_1.fixArrayStructureMiddleware, flight_controller_1.flightController.priceFlightOffer);
// Add route for advanced search (multi-city, etc.)
router.post("/advanced-search", fixArrays_middleware_1.fixArrayStructureMiddleware, flight_controller_1.flightController.advancedFlightSearch);
// Add dedicated route for multi-city search
router.post("/multi-city", fixArrays_middleware_1.fixArrayStructureMiddleware, multi_city_controller_1.searchMultiCityFlights);
// Add route for cheapest flight dates
router.get("/dates", flight_controller_1.flightController.searchFlightDates);
// Add route for price analysis
router.get("/analyze-price", flight_controller_1.flightController.analyzeFlightPrice);
// Add route for flight availabilities
router.post("/availabilities", fixArrays_middleware_1.fixArrayStructureMiddleware, flight_controller_1.flightController.searchFlightAvailabilities);
// Protected routes (require authentication)
router.post("/booking", authMiddleware_1.authMiddleware.protect, fixArrays_middleware_1.fixArrayStructureMiddleware, flight_controller_1.flightController.createBooking);
exports.default = router;
//# sourceMappingURL=flight.routes.js.map