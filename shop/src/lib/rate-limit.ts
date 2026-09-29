import "server-only";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-nf-client-connection-ip") || // Netlify proxy
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Fixed-window rate limit stored in Postgres so it holds across serverless
 * instances. Returns true when the request is allowed. Fails open if the
 * database call itself errors, so a limiter outage never blocks sales.
 */
export async function rateLimit(bucket: string, max: number, windowSeconds: number): Promise<boolean> {
  const key = `${bucket}:${await clientIp()}`;
  const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) {
    console.error("rate limit check failed", error);
    return true;
  }
  return data === true;
}
