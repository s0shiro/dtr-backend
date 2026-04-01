export const ERROR_MESSAGES = {
  INTERNAL_SERVER_ERROR: "Internal server error.",
  INVALID_ENVIRONMENT: "Invalid environment configuration.",
  DATABASE_CONNECTION_FAILED: "Failed to connect to the database.",
  DATABASE_QUERY_FAILED: "Database query failed.",
  UNAUTHORIZED: "Unauthorized.",
  FORBIDDEN: "Forbidden.",
  NOT_FOUND: "Resource not found.",
  VALIDATION_ERROR: "Validation error.",
  BAD_REQUEST: "Bad request.",
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
