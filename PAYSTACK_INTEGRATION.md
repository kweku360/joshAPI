# Paystack Payment Integration

This document provides information about the Paystack payment integration for the JoshTravel API.

## Overview

The API now supports payment processing using Paystack, a popular payment gateway in Africa. Paystack supports multiple payment methods including cards, bank transfers, USSD, and more.

## Configuration

To use the Paystack integration, you need to set the following environment variables:

```
PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret_here
```

These values can be obtained from your Paystack dashboard.

## API Endpoints

### Initialize Payment

Initiates a payment transaction with Paystack.

- **URL**: `/api/payments/initialize`
- **Method**: `POST`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "bookingId": "uuid-of-booking",
    "amount": 1000.5,
    "currency": "GHS",
    "email": "customer@example.com"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "authorizationUrl": "https://checkout.paystack.com/...",
      "accessCode": "access_code",
      "reference": "payment_reference"
    }
  }
  ```

### Verify Payment

Verifies a payment transaction with Paystack.

- **URL**: `/api/payments/verify/:reference`
- **Method**: `GET`
- **Authentication**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "id": "payment-id",
      "transactionId": "payment_reference",
      "status": "COMPLETED",
      "amount": 1000.5,
      "currency": "GHS",
      "createdAt": "2023-06-15T10:30:00Z"
    }
  }
  ```

### Webhook

Handles Paystack webhook events to automatically update payment status.

- **URL**: `/api/payments/webhook`
- **Method**: `POST`
- **Authentication**: None (Secured by signature verification)
- **Headers**:
  - `x-paystack-signature`: Signature from Paystack
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Webhook received",
    "data": {
      "paymentId": "payment-id"
    }
  }
  ```

## Implementation Steps

1. **Frontend Implementation**:

   - When a user completes a booking, send a request to `/api/payments/initialize`
   - Redirect the user to the `authorizationUrl` returned from the API
   - After payment completion, Paystack will redirect to your callback URL
   - Verify the payment using `/api/payments/verify/:reference`

2. **Webhook Setup**:

   - Set up a webhook in your Paystack dashboard pointing to `https://your-api.com/api/payments/webhook`
   - Add your webhook secret to the `PAYSTACK_WEBHOOK_SECRET` environment variable

3. **Testing**:
   - Use Paystack test credentials for development
   - Use Paystack test cards to simulate different payment scenarios

## Payment Flow

1. User creates a booking
2. API initializes payment with Paystack
3. User is redirected to Paystack checkout page
4. User completes payment on Paystack
5. Paystack redirects user back to your application
6. Your application verifies payment status
7. Webhook handles final confirmation and updates

## Supported Currencies

The integration currently supports the following currencies:

- GHS (Ghana Cedis)
- NGN (Nigerian Naira)
- USD (US Dollars)

## Error Handling

The API will return appropriate error messages for various payment scenarios:

- Invalid payment details
- Payment verification failures
- Expired payment sessions
- Declined transactions
