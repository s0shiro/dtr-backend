import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import { db } from "../db/index";
import { account, session, users, verification } from "../db/schema/users";
import { env } from "./db";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.FRONTEND_ORIGIN],
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
});
