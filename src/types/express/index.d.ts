export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        user: {
          id: string;
          email: string;
          name: string;
          dailyRate?: number | null | undefined;
          emailVerified: boolean;
          image?: string | null | undefined;
          createdAt: Date;
          updatedAt: Date;
        };
        session: {
          id: string;
          userId: string;
          token: string;
          expiresAt: Date;
          ipAddress?: string | null | undefined;
          userAgent?: string | null | undefined;
          createdAt: Date;
          updatedAt: Date;
        };
      };
    }
  }
}
