declare module '@paystack/paystack-sdk' {
  export class Paystack {
    constructor(secretKey: string);
    transaction: {
      initialize(data: {
        email: string;
        amount: number;
        currency: string;
        reference: string;
        callback_url?: string;
        metadata?: Record<string, any>;
      }): Promise<{
        status: boolean;
        message: string;
        data: {
          authorization_url: string;
          access_code: string;
          reference: string;
        };
      }>;
      verify(reference: string): Promise<{
        status: boolean;
        message: string;
        data: {
          status: string;
          reference: string;
          amount: number;
          currency: string;
          metadata: Record<string, any>;
        };
      }>;
    };
  }
}

declare module 'paystack-api' {
  function Paystack(secretKey: string): Paystack;
  
  interface Paystack {
    transaction: {
      initialize(params: {
        amount: number;
        email: string;
        reference?: string;
        currency?: string;
        callback_url?: string;
        metadata?: Record<string, any>;
      }): Promise<{
        status: boolean;
        message: string;
        data: {
          authorization_url: string;
          access_code: string;
          reference: string;
        };
      }>;
      
      verify(params: {
        reference: string;
      }): Promise<{
        status: boolean;
        message: string;
        data: {
          status: string;
          reference: string;
          amount: number;
          currency: string;
          transaction_date: string;
          gateway_response: string;
          receipt_url?: string;
          customer: {
            email: string;
            name?: string;
          };
          metadata?: Record<string, any>;
        };
      }>;
    };
  }
  
  export = Paystack;
} 