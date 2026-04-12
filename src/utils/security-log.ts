import type { Request } from "express";

interface SecurityEventContext {
  reason?: string | undefined;
  originPresent?: boolean | undefined;
  refererPresent?: boolean | undefined;
  keyType?: "user+ip" | "ip" | undefined;
  origin?: string | undefined;
}

interface SecurityEventInput {
  req?: Request | undefined;
  userId?: string | undefined;
  context?: SecurityEventContext | undefined;
}

export function logSecurityEvent(event: string, input: SecurityEventInput = {}): void {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    method: input.req?.method,
    path: input.req?.originalUrl ?? input.req?.path,
    ip: input.req?.ip,
    userId: input.userId,
    context: input.context,
  };

  console.warn("[security]", payload);
}
