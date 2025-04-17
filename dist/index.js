"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const compression_1 = __importDefault(require("compression"));
const errorHandler_1 = require("./middleware/errorHandler");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const flight_routes_1 = __importDefault(require("./routes/flight.routes"));
const booking_routes_1 = __importDefault(require("./routes/booking.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const config_1 = __importDefault(require("./config"));
const logger_1 = require("./utils/logger");
const hpp_1 = __importDefault(require("hpp"));
const xss_clean_1 = __importDefault(require("xss-clean"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const app = (0, express_1.default)();
// Set security HTTP headers
app.use((0, helmet_1.default)());
// CORS configuration
app.use((0, cors_1.default)({
    origin: config_1.default.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
// Body parser with size limit
app.use(express_1.default.json({ limit: "10kb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10kb" }));
// Data sanitization against NoSQL query injection
app.use((0, express_mongo_sanitize_1.default)());
// Data sanitization against XSS
app.use((0, xss_clean_1.default)());
// Prevent parameter pollution
app.use((0, hpp_1.default)());
// Cookie parser
app.use((0, cookie_parser_1.default)(config_1.default.cookieSecret));
// Compression
app.use((0, compression_1.default)());
// Add security headers
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
});
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.default.rateLimit.windowMs,
    max: config_1.default.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again later",
});
app.use("/api", limiter);
// Auth-specific rate limiting
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many auth attempts, please try again later",
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
// Routes
app.use("/api/auth", auth_routes_1.default);
app.use("/api/users", user_routes_1.default);
app.use("/api/flights", flight_routes_1.default);
app.use("/api/bookings", booking_routes_1.default);
app.use("/api/payments", payment_routes_1.default);
// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});
// 404 handler for undefined routes
app.all("*", (req, res, next) => {
    res.status(404).json({
        status: "error",
        message: `Cannot find ${req.method} ${req.originalUrl} on this server`,
    });
});
// Error handling middleware
app.use(errorHandler_1.errorHandler);
// Start server
const PORT = config_1.default.port || 3001;
const server = app.listen(PORT, () => {
    logger_1.logger.info(`Server running in ${config_1.default.env} mode on port ${PORT}`);
});
// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
    logger_1.logger.error("UNHANDLED REJECTION! 💥 Shutting down...");
    logger_1.logger.error(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});
// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
    logger_1.logger.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
    logger_1.logger.error(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});
// Handle SIGTERM
process.on("SIGTERM", () => {
    logger_1.logger.info("SIGTERM received. Shutting down gracefully");
    server.close(() => {
        logger_1.logger.info("Process terminated");
    });
});
//# sourceMappingURL=index.js.map