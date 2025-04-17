// Create typescript type definitions

import { FlightOffer as AmadeusFlightOffer } from './flight';

// Re-export the FlightOffer type
export type FlightOffer = AmadeusFlightOffer;

// Booking Status Enum
export enum BookingStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

// Payment Status Enum
export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

// User Status Enum
export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
}

// Role Enum
export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
}

// Token Type Enum
export enum TokenType {
  EMAIL_VERIFICATION = "EMAIL_VERIFICATION",
  PASSWORD_RESET = "PASSWORD_RESET",
  PHONE_VERIFICATION = "PHONE_VERIFICATION",
  OTP_AUTHENTICATION = "OTP_AUTHENTICATION",
}

// Auth Provider Enum
export enum AuthProvider {
  EMAIL = "EMAIL",
  GOOGLE = "GOOGLE",
  OTP = "OTP",
}

// Amadeus Type Definitions
export interface FlightSearchParams {
  originLocationCode: string;
  destinationLocationCode: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  children?: number;
  infants?: number;
  travelClass?: string;
  currencyCode?: string;
  maxPrice?: number;
  max?: number;
  includedAirlineCodes?: string;
  excludedAirlineCodes?: string;
  nonStop?: boolean;
}

export interface PassengerDetail {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  email?: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
  documentIssuingCountry?: string;
  documentExpiryDate?: string;
}

export interface BookingCreateParams {
  userId: string;
  flightOfferId: string;
  flightOfferData: FlightOffer;
  passengerDetails: PassengerDetail[];
  totalAmount: number;
  currency?: string;
}

export interface LocationAddress {
  cityName?: string;
  cityCode?: string;
  countryName?: string;
  countryCode: string;
  stateCode?: string;
  regionCode?: string;
}

export interface GeoCode {
  latitude: number;
  longitude: number;
}

export interface Location {
  type: string;
  subType: string;
  name: string;
  detailedName: string;
  id: string;
  self: {
    href: string;
    methods: string[];
  };
  timeZoneOffset?: string;
  iataCode?: string;
  address?: LocationAddress;
  geoCode?: GeoCode;
  distance?: {
    value: number;
    unit: string;
  };
  analytics?: {
    travelers: {
      score: number;
    };
  };
  relevance?: number;
}

// Interface matching the Prisma VerificationToken model
export interface IVerificationToken {
  id: string;
  token: string;
  type: TokenType;
  expiresAt: Date;
  createdAt: Date;
  userId: string;
  user?: IUser;
}

// Interface matching the Prisma User model
export interface IUser {
  id: string;
  email: string;
  password?: string | null;
  name?: string | null;
  phone?: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isGuest: boolean;
  role: Role;
  status: UserStatus;
  googleId?: string | null;
  authProvider: AuthProvider;
  passwordResetAt?: Date | null;
  passwordResetToken?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
}

// Interface matching the Prisma Booking model
export interface IBooking {
  id: string;
  bookingReference: string;
  userId?: string | null;
  flightOfferData: any;
  passengerDetails: any;
  status: BookingStatus;
  failureReason?: string | null;
  amadeusOrderId?: string | null;
  amadeusOrderData?: any;
  contactEmail: string;
  contactPhone?: string | null;
  totalAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date | null;
  eTicketUrl?: string | null;
}

// Interface matching the Prisma Payment model
export interface IPayment {
  id: string;
  transactionId: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: PaymentStatus;
  paymentData?: any;
  createdAt: Date;
  updatedAt: Date;
}
