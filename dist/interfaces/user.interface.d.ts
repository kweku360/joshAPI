export declare enum AuthProvider {
    EMAIL = "EMAIL",
    GOOGLE = "GOOGLE",
    OTP = "OTP"
}
export declare enum Role {
    USER = "USER",
    ADMIN = "ADMIN"
}
export declare enum UserStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    SUSPENDED = "SUSPENDED"
}
export interface IUser {
    id: string;
    email: string;
    password: string | null;
    name: string | null;
    phone: string | null;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    isGuest: boolean;
    role: Role;
    status: UserStatus;
    passwordResetAt: Date | null;
    passwordResetToken: string | null;
    googleId: string | null;
    authProvider: AuthProvider;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
}
export interface IGuestUser {
    id: string;
    email: string;
    isGuest: boolean;
    token?: string;
}
//# sourceMappingURL=user.interface.d.ts.map