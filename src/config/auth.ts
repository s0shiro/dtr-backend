import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import { db } from "../db/index.js";
import { account, session, users, verification } from "../db/schema/users.js";
import { env } from "./db.js";

// Environment detection
const isProduction = process.env["NODE_ENV"] === "production";

// Parse multiple frontend origins (comma-separated for Vercel production + preview deployments)
const parseTrustedOrigins = (origin: string): string[] => {
  return origin.split(",").map((url) => url.trim());
};

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  
  // Support multiple trusted origins (production + preview deployments)
  trustedOrigins: parseTrustedOrigins(env.FRONTEND_ORIGIN),
  
  user: {
    additionalFields: {
      dailyRate: {
        type: "number",
        required: false,
        input: false,
      },
    },
  },
  
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session,
      account,
      verification,
    },
  }),
  
  emailAndPassword: {
    enabled: true,
  },
  
  // Advanced cookie configuration for production deployment
  advanced: {
    trustedProxyHeaders: true, // MUST BE TRUE for proxy
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax", 
      path: "/",
    },
  },
});
