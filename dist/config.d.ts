declare const config: {
    env: "development" | "test" | "production";
    port: number;
    databaseUrl: string;
    jwtSecret: string;
    jwtExpiresIn: string;
    jwtCookieExpiresIn: number;
    cookieSecret: string;
    email: {
        from: string;
        host: string;
        port: number;
        username: string;
        password: string;
    };
    amadeus: {
        clientId: string;
        clientSecret: string;
        apiEnv: "test" | "production";
    };
    google: {
        clientId: string;
        clientSecret: string;
    };
    frontendUrl: string;
    corsOrigins: string[];
    rateLimit: {
        enabled: boolean;
        windowMs: number;
        max: number;
    };
    bcryptSaltRounds: number;
    redis: {
        url: string;
        host: string;
        port: number;
        username: string;
        password: string;
        tls: boolean;
        unavailable: boolean;
        errorLogged: boolean;
    };
    otp: {
        expirySeconds: number;
    };
    offer: {
        expirySeconds: number;
    };
    paystack: {
        secretKey: string;
        publicKey: string;
        baseUrl: string;
        webhookSecret: string;
    };
};
export default config;
//# sourceMappingURL=config.d.ts.map