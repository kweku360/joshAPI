# JoshAPI - Flight Booking API

A secure and robust flight booking API built with Node.js, Express, TypeScript, and Prisma. This API integrates with the Amadeus API for flight search, booking, and management.

## Features

- **Authentication & Authorization**

  - User signup, login, logout
  - Email verification
  - Password reset
  - Role-based access control
  - JWT authentication
  - OTP Authentication

- **Flight Services**

  - Search flights with advanced filtering
  - Get flight prices
  - Search airports by keyword
  - Flight date analysis
  - Price analysis

- **Booking Services**

  - Create and manage bookings
  - View booking details
  - Cancel bookings
  - Generate e-tickets

- **Payment Processing**

  - Secure payment integration
  - Payment status tracking
  - Transaction history

- **Security Features**
  - Data sanitization against NoSQL query injection
  - XSS protection
  - CSRF protection
  - Parameter pollution protection
  - Rate limiting
  - Secure HTTP headers

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT, bcrypt
- **Caching & OTP Storage**: Redis
- **Validation**: Zod
- **External APIs**: Amadeus
- **Logging**: Winston
- **Email**: Nodemailer

## Getting Started

### Prerequisites

- Node.js (v16+)
- PostgreSQL
- Amadeus API credentials
- Redis (for OTP storage)

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/henryamos/joshAPI.git
   cd joshAPI
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Create a `.env` file in the root directory:

   ```
   NODE_ENV=development
   PORT=3001
   DATABASE_URL=postgresql://user:password@localhost:5432/joshapi
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRES_IN=7d
   JWT_COOKIE_EXPIRES_IN=7
   COOKIE_SECRET=your_cookie_secret
   EMAIL_FROM=noreply@joshtravels.com
   EMAIL_HOST=smtp.example.com
   EMAIL_PORT=587
   EMAIL_USERNAME=your_email_username
   EMAIL_PASSWORD=your_email_password
   AMADEUS_CLIENT_ID=your_amadeus_client_id
   AMADEUS_CLIENT_SECRET=your_amadeus_client_secret
   AMADEUS_API_ENV=test
   FRONTEND_URL=http://localhost:3000
   CORS_ORIGINS=http://localhost:3000
   ENABLE_RATE_LIMIT=true
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX=100
   BCRYPT_SALT_ROUNDS=12

   # Redis Configuration (Required for OTP storage)
   REDIS_URL=redis://username:password@your-redis-host:port
   # OR use individual settings (if not using URL)
   # REDIS_HOST=localhost
   # REDIS_PORT=6379
   # REDIS_USERNAME=
   # REDIS_PASSWORD=
   # REDIS_TLS=false
   ```

4. Set up the database:

   ```
   npm run db:migrate
   npm run db:generate
   ```

5. Start the development server:
   ```
   npm run dev
   ```

## API Documentation

### Authentication Endpoints

#### OTP Authentication Routes

- `POST /api/auth/register-otp` - Request OTP for registration
  - Request body: `{ "email": "user@example.com" }`
- `POST /api/auth/verify-otp` - Verify OTP for registration
  - Request body: `{ "email": "user@example.com", "otp": "123456" }`
- `POST /api/auth/login-otp` - Request OTP for login
  - Request body: `{ "email": "user@example.com" }`
- `POST /api/auth/verify-login-otp` - Verify OTP for login
  - Request body: `{ "email": "user@example.com", "otp": "123456" }`

#### Google OAuth

- `POST /api/auth/google` - Authenticate with Google
  - Request body: `{ "token": "google_id_token" }`

#### Guest Account

- `POST /api/auth/guest` - Create guest account
  - Request body: `{ "email": "guest@example.com" }`
- `POST /api/auth/verify-guest` - Verify OTP for guest account
  - Request body: `{ "email": "guest@example.com", "otp": "123456" }`
- `POST /api/auth/upgrade-guest` - Upgrade guest account to permanent
  - Request body: `{ "email": "guest@example.com", "name": "Guest User", "password": "securepassword" }`

#### Other Auth Endpoints

- `POST /api/auth/logout` - Logout current user
  - No request body required

### User Endpoints

All user endpoints require authentication.

- `GET /api/users/profile` - Get user profile

  - Response: User profile data

- `GET /api/users/profile/dashboard` - Get user profile with bookings

  - Response: User profile with bookings data

- `PATCH /api/users/profile` - Update user profile

  - Request body: `{ "name": "Updated Name", "phone": "1234567890" }`

- `GET /api/users/bookings` - Get user's bookings

  - Response: List of user bookings

- `DELETE /api/users/account` - Delete user account (CSRF protected)
  - Request body: `{ "_csrf": "csrf_token" }`

### Flight Endpoints

#### Public Routes

- `GET /api/flights/locations` - Search airport locations
  - Query parameters: `keyword=[search term]`
- `POST /api/flights/search` - Search available flights
  - Request body:
    ```json
    {
      "originLocationCode": "LHR",
      "destinationLocationCode": "JFK",
      "departureDate": "2023-10-15",
      "returnDate": "2023-10-22",
      "adults": 1,
      "children": 0,
      "infants": 0,
      "travelClass": "ECONOMY",
      "currencyCode": "USD",
      "maxPrice": 1000,
      "nonStop": false
    }
    ```
- `POST /api/flights/price` - Get pricing for flight offer

  - Request body: `{ "flightOfferId": "offer_id", "flightOfferData": {...} }`

- `GET /api/flights/dates` - Search for cheapest flight dates

  - Query parameters:
    ```
    originLocationCode=LHR
    destinationLocationCode=JFK
    departureDate=2023-10-15
    returnDate=2023-10-22
    ```

- `GET /api/flights/analyze-price` - Analyze flight prices
  - Query parameters:
    ```
    originLocationCode=LHR
    destinationLocationCode=JFK
    departureDate=2023-10-15
    returnDate=2023-10-22
    ```

#### Protected Routes

- `POST /api/flights/booking` - Create flight booking (requires auth)
  - Request body:
    ```json
    {
      "flightOfferId": "offer_id",
      "flightOfferData": {...},
      "passengerDetails": [
        {
          "id": "1",
          "firstName": "John",
          "lastName": "Doe",
          "dateOfBirth": "1990-01-01",
          "gender": "MALE",
          "email": "john@example.com",
          "phone": "+1234567890"
        }
      ],
      "contactEmail": "john@example.com",
      "contactPhone": "+1234567890"
    }
    ```

### Booking Endpoints

All booking routes require authentication.

#### Booking Operations

- `POST /api/bookings` - Create booking (CSRF protected)

  - Request body:
    ```json
    {
      "flightOfferId": "offer_id",
      "flightOfferData": {...},
      "passengerDetails": [...],
      "contactEmail": "user@example.com",
      "contactPhone": "+1234567890",
      "totalAmount": 1200.50,
      "currency": "USD"
    }
    ```

- `PATCH /api/bookings/:id/cancel` - Cancel booking (CSRF protected)
  - Request body: `{ "_csrf": "csrf_token" }`

#### Booking Retrieval

- `GET /api/bookings` - Get all user bookings

  - Query parameters: `status=[PENDING|CONFIRMED|CANCELLED|COMPLETED]`

- `GET /api/bookings/:id` - Get booking by ID

  - Response: Booking details

- `GET /api/bookings/reference/:reference` - Get booking by reference

  - Response: Booking details

- `GET /api/bookings/:id/e-ticket` - Generate e-ticket
  - Response: E-ticket URL or download

#### Flight Booking Routes

- `POST /api/bookings/flights` - Create flight booking

  - Request body: Similar to `POST /api/bookings`

- `GET /api/bookings/flights` - Get user's flight bookings

  - Response: List of flight bookings

- `GET /api/bookings/flights/:id` - Get flight booking details
  - Response: Flight booking details

#### Admin Routes

- `POST /api/bookings/:id/confirm` - Confirm booking with Amadeus (Admin only, CSRF protected)
  - Request body: `{ "_csrf": "csrf_token" }`

### Payment Endpoints

All payment routes require authentication.

- `POST /api/payments/create-intent` - Create payment intent

  - Request body: `{ "bookingId": "booking_id", "amount": 1200.50, "currency": "USD" }`

- `POST /api/payments/confirm` - Confirm payment

  - Request body: `{ "paymentIntentId": "intent_id", "bookingId": "booking_id" }`

- `GET /api/payments/history` - Get payment history

  - Response: List of user payments

- `POST /api/payments/process` - Process payment

  - Request body: `{ "bookingId": "booking_id", "paymentMethod": "card", "amount": 1200.50, "currency": "USD" }`

- `GET /api/payments/:id` - Get payment by ID

  - Response: Payment details

- `GET /api/payments/transaction/:transactionId` - Get payment by transaction ID

  - Response: Payment details

- `GET /api/payments/booking/:bookingId` - Get payments for a booking
  - Response: List of payments for a booking

## Security Measures

This API implements multiple layers of security:

1. **Data Validation**: Strict input validation using Zod
2. **Authentication**: JWT-based authentication with secure cookie options
3. **Rate Limiting**: Prevents brute force attacks
4. **CSRF Protection**: Prevents cross-site request forgery
5. **XSS Protection**: Prevents cross-site scripting attacks
6. **Parameter Pollution Protection**: Prevents HTTP parameter pollution
7. **Secure Headers**: Implementation of security-related HTTP headers
8. **Error Handling**: Secure error handling that doesn't leak sensitive information

## License

This project is licensed under the ISC License.

## Author

[Henry Amos](https://github.com/henryamos)
