import { z } from "zod";

const trustProxySchema = z
  .string()
  .default("1")
  .transform((value) => {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "true") {
      return true;
    }

    if (normalizedValue === "false") {
      return false;
    }

    if (/^\d+$/.test(normalizedValue)) {
      return Number(normalizedValue);
    }

    throw new Error("TRUST_PROXY must be true, false, or a non-negative integer");
  });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  TRUST_PROXY: trustProxySchema,
  FRONTEND_ORIGIN: z.string().min(1, "FRONTEND_ORIGIN is required").default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("Asia/Manila"),
  OFFICE_LATITUDE: z.coerce.number().optional(),
  OFFICE_LONGITUDE: z.coerce.number().optional(),
  OFFICE_RADIUS_METERS: z.coerce.number().positive().default(50),
  HOLIDAY_COUNTRY_CODE: z.string().trim().min(2).max(3).default("PH"),
  HOLIDAY_API_BASE_URL: z.string().url().default("https://date.nager.at/api/v3"),
  INTERNAL_AUTOMATION_SECRET: z.string().min(1).optional(),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_AUTOMATION_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_AUTOMATION_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_USER_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_USER_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  N8N_GEOFENCE_WEBHOOK_URL: z.string().url().optional(),
  N8N_WEBHOOK_SECRET: z.string().min(1).optional(),
  ENABLE_HOLIDAY_CRON: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value ?? "true") === "true"),
  API_NINJAS_KEY: z.string().min(1).optional(),
  API_NINJAS_QUOTES_URL: z.string().url().default("https://api.api-ninjas.com/v2/quotes"),
  API_NINJAS_QUOTE_CATEGORIES: z.string().default("success,wisdom"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = parsed.data;

export const dbConfig = {
  connectionString: env.DATABASE_URL,
};
