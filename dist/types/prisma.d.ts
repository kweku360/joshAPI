import { Prisma } from "@prisma/client";
export type { Prisma };
export { BookingStatus, PaymentStatus } from "@prisma/client";
export type Payment = {
    id: string;
    transactionId: string;
    bookingId: string;
    userId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    status: string;
    paymentData?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    booking?: {
        id: string;
        bookingReference: string;
        status: string;
    };
    user?: {
        id: string;
        email: string;
        name?: string;
    };
};
//# sourceMappingURL=prisma.d.ts.map