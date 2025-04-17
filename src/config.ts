import dotenv from "dotenv";
import { cleanEnv, str, port, url, bool, num } from "envalid";

dotenv.config();

// Validate environment variables
const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production"],
    default: "development",
  }),
  PORT: port({ default: 3001 }),
  DATABASE_URL: url(),
  JWT_SECRET: str(),
  JWT_EXPIRES_IN: str({ default: "7d" }),
  JWT_COOKIE_EXPIRES_IN: num({ default: 7 }),
  COOKIE_SECRET: str(),
  EMAIL_FROM: str({ default: "noreply@joshtravels.com" }),
  EMAIL_HOST: str(),
  EMAIL_PORT: port(),
  EMAIL_USERNAME: str(),
  EMAIL_PASSWORD: str(),
  AMADEUS_CLIENT_ID: str(),
  AMADEUS_CLIENT_SECRET: str(),
  AMADEUS_API_ENV: str({ choices: ["test", "production"], default: "test" }),
  FRONTEND_URL: url(),
  CORS_ORIGINS: str({ default: "*" }),
  ENABLE_RATE_LIMIT: bool({ default: true }),
  RATE_LIMIT_WINDOW_MS: num({ default: 15 * 60 * 1000 }), // 15 minutes
  RATE_LIMIT_MAX: num({ default: 100 }),
  BCRYPT_SALT_ROUNDS: num({ default: 12 }),
  REDIS_URL: str({ default: "" }),
  REDIS_HOST: str({ default: "localhost" }),
  REDIS_PORT: port({ default: 6379 }),
  REDIS_USERNAME: str({ default: "" }),
  REDIS_PASSWORD: str({ default: "" }),
  REDIS_TLS: bool({ default: false }),
  OTP_EXPIRY_SECONDS: num({ default: 300 }), // 5 minutes
  OFFER_EXPIRY_SECONDS: num({ default: 600 }), // 10 minutes
  GOOGLE_CLIENT_ID: str({ default: "" }),
  GOOGLE_CLIENT_SECRET: str({ default: "" }),
  PAYSTACK_SECRET_KEY: str(),
  PAYSTACK_PUBLIC_KEY: str(),
  PAYSTACK_WEBHOOK_SECRET: str(),
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

export default config;
