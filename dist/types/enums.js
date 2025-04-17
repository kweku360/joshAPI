"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthProvider = exports.TokenType = exports.Role = exports.UserStatus = exports.PaymentStatus = exports.BookingStatus = void 0;
// Booking Status Enum
var BookingStatus;
(function (BookingStatus) {
    BookingStatus["PENDING"] = "PENDING";
    BookingStatus["CONFIRMED"] = "CONFIRMED";
    BookingStatus["CANCELLED"] = "CANCELLED";
    BookingStatus["COMPLETED"] = "COMPLETED";
    BookingStatus["FAILED"] = "FAILED";
    BookingStatus["PAYMENT_FAILED"] = "PAYMENT_FAILED";
    BookingStatus["REFUNDED"] = "REFUNDED";
})(BookingStatus || (exports.BookingStatus = BookingStatus = {}));
// Payment Status Enum
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["COMPLETED"] = "COMPLETED";
    PaymentStatus["FAILED"] = "FAILED";
    PaymentStatus["REFUNDED"] = "REFUNDED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
// User Status Enum
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "ACTIVE";
    UserStatus["INACTIVE"] = "INACTIVE";
    UserStatus["SUSPENDED"] = "SUSPENDED";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
// Role Enum
var Role;
(function (Role) {
    Role["USER"] = "USER";
    Role["ADMIN"] = "ADMIN";
})(Role || (exports.Role = Role = {}));
// Token Type Enum
var TokenType;
(function (TokenType) {
    TokenType["EMAIL_VERIFICATION"] = "EMAIL_VERIFICATION";
    TokenType["PASSWORD_RESET"] = "PASSWORD_RESET";
    TokenType["PHONE_VERIFICATION"] = "PHONE_VERIFICATION";
    TokenType["OTP_AUTHENTICATION"] = "OTP_AUTHENTICATION";
})(TokenType || (exports.TokenType = TokenType = {}));
// Auth Provider Enum
var AuthProvider;
(function (AuthProvider) {
    AuthProvider["EMAIL"] = "EMAIL";
    AuthProvider["GOOGLE"] = "GOOGLE";
    AuthProvider["OTP"] = "OTP";
})(AuthProvider || (exports.AuthProvider = AuthProvider = {}));
//# sourceMappingURL=enums.js.map