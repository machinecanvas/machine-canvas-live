import "server-only";
import { supabaseProjectUrl } from "@/lib/supabase/url";

// Server-only environment access. Throws a clear error when a variable is
// missing so misconfiguration shows up at the first request, not as a
// confusing downstream failure.
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (see shop/.env.example)`);
  return value;
}

export const env = {
  supabaseUrl: () => supabaseProjectUrl(required("NEXT_PUBLIC_SUPABASE_URL")),
  supabasePublishableKey: () => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY"),
  stripeSecretKey: () => required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET"),
  resendApiKey: () => required("RESEND_API_KEY"),
  emailFrom: () => required("EMAIL_FROM"),
  ownerEmail: () => required("OWNER_EMAIL"),
  adminEmails: () =>
    required("ADMIN_EMAILS")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  siteUrl: () => required("SITE_URL").replace(/\/$/, ""),
  cronSecret: () => required("CRON_SECRET"),
  // Google Calendar is optional in development: without it, availability
  // ignores the calendar and no events are written.
  google: () => {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    if (!email || !key || !calendarId) return null;
    return { email, key: key.replace(/\\n/g, "\n"), calendarId };
  },
};

/** Public URL of a shop page, e.g. shopUrl("/success") -> https://…/shop/success */
export function shopUrl(path: string): string {
  return `${env.siteUrl()}/shop${path}`;
}
