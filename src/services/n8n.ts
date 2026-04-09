import { env } from "../config/db.js";

export interface GeofenceReminderEvent {
  userId: string;
  userEmail: string;
  enteredAt: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  distanceMeters: number | null;
  radiusMeters: number;
}

function getWebhookHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (env.N8N_WEBHOOK_SECRET) {
    headers["x-webhook-secret"] = env.N8N_WEBHOOK_SECRET;
  }

  return headers;
}

export function hasN8nGeofenceWebhook(): boolean {
  return Boolean(env.N8N_GEOFENCE_WEBHOOK_URL);
}

export async function triggerGeofenceReminder(event: GeofenceReminderEvent): Promise<void> {
  if (!env.N8N_GEOFENCE_WEBHOOK_URL) {
    return;
  }

  const response = await fetch(env.N8N_GEOFENCE_WEBHOOK_URL, {
    method: "POST",
    headers: getWebhookHeaders(),
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error(`n8n geofence webhook failed with status ${response.status}`);
  }
}
