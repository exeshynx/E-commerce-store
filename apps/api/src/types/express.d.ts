declare global {
  namespace Express {
    interface Request {
      auth?: {
        role: 'ADMIN' | 'CUSTOMER';
        sessionId: string;
        userId: string;
      };
      shopper?: {
        isGuest: boolean;
        userId: string;
      };
      id: string;
    }
  }
}

export {};
