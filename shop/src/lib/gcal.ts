import "server-only";
import { JWT } from "google-auth-library";
import { env } from "@/lib/env";

// Minimal Google Calendar client (service account). The owner shares their
// calendar with the service account email ("Make changes to events").

const API = "https://www.googleapis.com/calendar/v3";

let jwt: JWT | null = null;

async function authHeader(): Promise<Record<string, string> | null> {
  const g = env.google();
  if (!g) return null;
  jwt ??= new JWT({ email: g.email, key: g.key, scopes: ["https://www.googleapis.com/auth/calendar"] });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("Google auth returned no access token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function call<T>(path: string, init: RequestInit & { headers: Record<string, string> }): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok && !(init.method === "DELETE" && (res.status === 404 || res.status === 410))) {
    throw new Error(`Google Calendar ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.status === 204 || init.method === "DELETE" ? (undefined as T) : ((await res.json()) as T);
}

export type BusyInterval = { start: Date; end: Date };

/** Busy intervals on the business calendar, or [] if the calendar isn't configured. */
export async function busyIntervals(timeMin: Date, timeMax: Date): Promise<BusyInterval[]> {
  const headers = await authHeader();
  const g = env.google();
  if (!headers || !g) return [];
  const data = await call<{ calendars: Record<string, { busy?: { start: string; end: string }[] }> }>(
    "/freeBusy",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [{ id: g.calendarId }] }),
    },
  );
  return (data.calendars[g.calendarId]?.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export type CalendarEventInput = {
  summary: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
  bookingId: string;
};

/** Create the job event. Returns null if the calendar isn't configured. */
export async function createEvent(e: CalendarEventInput): Promise<string | null> {
  const headers = await authHeader();
  const g = env.google();
  if (!headers || !g) return null;
  // A deterministic event id makes retries idempotent: a second insert with
  // the same id returns 409 instead of creating a duplicate.
  const id = `mc${e.bookingId.replace(/-/g, "")}`;
  const res = await fetch(`${API}/calendars/${encodeURIComponent(g.calendarId)}/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id,
      summary: e.summary,
      description: e.description,
      location: e.location,
      start: { dateTime: e.start.toISOString() },
      end: { dateTime: e.end.toISOString() },
    }),
  });
  if (res.status === 409) return id;
  if (!res.ok) throw new Error(`Google Calendar insert failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const headers = await authHeader();
  const g = env.google();
  if (!headers || !g) return;
  await call(`/calendars/${encodeURIComponent(g.calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers,
  });
}
