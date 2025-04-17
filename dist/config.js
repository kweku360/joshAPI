"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const envalid_1 = require("envalid");
dotenv_1.default.config();
// Validate environment variables
const env = (0, envalid_1.cleanEnv)(process.env, {
    NODE_ENV: (0, envalid_1.str)({
        choices: ["development", "test", "production"],
        default: "development",
    }),
    PORT: (0, envalid_1.port)({ default: 3001 }),
    DATABASE_URL: (0, envalid_1.url)(),
    JWT_SECRET: (0, envalid_1.str)(),
    JWT_EXPIRES_IN: (0, envalid_1.str)({ default: "7d" }),
    JWT_COOKIE_EXPIRES_IN: (0, envalid_1.num)({ default: 7 }),
    COOKIE_SECRET: (0, envalid_1.str)(),
    EMAIL_FROM: (0, envalid_1.str)({ default: "noreply@joshtravels.com" }),
    EMAIL_HOST: (0, envalid_1.str)(),
    EMAIL_PORT: (0, envalid_1.port)(),
    EMAIL_USERNAME: (0, envalid_1.str)(),
    EMAIL_PASSWORD: (0, envalid_1.str)(),
    AMADEUS_CLIENT_ID: (0, envalid_1.str)(),
    AMADEUS_CLIENT_SECRET: (0, envalid_1.str)(),
    AMADEUS_API_ENV: (0, envalid_1.str)({ choices: ["test", "production"], default: "test" }),
    FRONTEND_URL: (0, envalid_1.url)(),
    CORS_ORIGINS: (0, envalid_1.str)({ default: "*" }),
    ENABLE_RATE_LIMIT: (0, envalid_1.bool)({ default: true }),
    RATE_LIMIT_WINDOW_MS: (0, envalid_1.num)({ default: 15 * 60 * 1000 }), // 15 minutes
    RATE_LIMIT_MAX: (0, envalid_1.num)({ default: 100 }),
    BCRYPT_SALT_ROUNDS: (0, envalid_1.num)({ default: 12 }),
    REDIS_URL: (0, envalid_1.str)({ default: "" }),
    REDIS_HOST: (0, envalid_1.str)({ default: "localhost" }),
    REDIS_PORT: (0, envalid_1.port)({ default: 6379 }),
    REDIS_USERNAME: (0, envalid_1.str)({ default: "" }),
    REDIS_PASSWORD: (0, envalid_1.str)({ default: "" }),
    REDIS_TLS: (0, envalid_1.bool)({ default: false }),
    OTP_EXPIRY_SECONDS: (0, envalid_1.num)({ default: 300 }), // 5 minutes
    OFFER_EXPIRY_SECONDS: (0, envalid_1.num)({ default: 600 }), // 10 minutes
    GOOGLE_CLIENT_ID: (0, envalid_1.str)({ default: "" }),
    GOOGLE_CLIENT_SECRET: (0, envalid_1.str)({ default: "" }),
    PAYSTACK_SECRET_KEY: (0, envalid_1.str)(),
    PAYSTACK_PUBLIC_KEY: (0, envalid_1.str)(),
    PAYSTACK_WEBHOOK_SECRET: (0, envalid_1.str)(),
});
const config = {
    env: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    jwtCookieExpiresIn: env.JWT_COOKIE_EXPIRES_IN,
    cookieSecret: env.COOKIE_SECRET,
    email: {
        from: env.EMAIL_FROM,
        host: env.EMAIL_HOST,
        port: env.EMAIL_PORT,
        username: env.EMAIL_USERNAME,
        password: env.EMAIL_PASSWORD,
    },
    amadeus: {
        clientId: env.AMADEUS_CLIENT_ID || "",
        clientSecret: env.AMADEUS_CLIENT_SECRET || "",
        apiEnv: env.AMADEUS_API_ENV || "test",
    },
    google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    frontendUrl: env.FRONTEND_URL,
    corsOrigins: env.CORS_ORIGINS.split(","),
    rateLimit: {
        enabled: env.ENABLE_RATE_LIMIT,
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        max: env.RATE_LIMIT_MAX,
    },
    bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
    redis: {
        url: env.REDIS_URL || `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`,
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        username: env.REDIS_USERNAME,
        password: env.REDIS_PASSWORD,
        tls: env.REDIS_TLS,
        // Operational state flags
        unavailable: false,
        errorLogged: false,
    },
    otp: {
        expirySeconds: env.OTP_EXPIRY_SECONDS,
    },
    offer: {
        expirySeconds: env.OFFER_EXPIRY_SECONDS,
    },
    paystack: {
        secretKey: env.PAYSTACK_SECRET_KEY || "",
        publicKey: env.PAYSTACK_PUBLIC_KEY || "",
        baseUrl: "https://api.paystack.co",
        webhookSecret: env.PAYSTACK_SECRET_KEY || "",
    },
};
exports.default = config;
//# sourceMappingURL=config.js.map