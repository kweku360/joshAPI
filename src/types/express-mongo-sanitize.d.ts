declare module 'express-mongo-sanitize' {
  import { RequestHandler } from 'express';
  
  interface SanitizeOptions {
    replaceWith?: string;
    onSanitize?: (key: string, value: any) => void;
  }

  function mongoSanitize(options?: SanitizeOptions): RequestHandler;
  
  export = mongoSanitize;
}