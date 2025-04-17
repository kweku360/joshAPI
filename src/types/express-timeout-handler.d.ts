declare module 'express-timeout-handler' {
  import { RequestHandler } from 'express';
  
  interface TimeoutOptions {
    timeout?: number;
    onTimeout?: (req: any, res: any, next: any) => void;
    onDelayedResponse?: (req: any, res: any, next: any, error: any) => void;
  }

  const handler: {
    set: (options: TimeoutOptions) => RequestHandler;
  };
  
  export = handler;
}