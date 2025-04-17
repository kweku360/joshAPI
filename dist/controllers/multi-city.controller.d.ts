import { Request, Response, NextFunction } from "express";
/**
 * Search for multi-city flights
 * This is a dedicated controller to handle the multi-city flight search
 * to avoid issues with the originDestinations format
 */
export declare const searchMultiCityFlights: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=multi-city.controller.d.ts.map