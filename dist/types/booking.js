"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asPrismaBooking = asPrismaBooking;
// Helper function to convert Prisma booking to typed booking
function asPrismaBooking(booking) {
    return Object.assign(Object.assign({}, booking), { flightOfferData: booking.flightOfferData, passengerDetails: booking.passengerDetails, status: booking.status });
}
//# sourceMappingURL=booking.js.map